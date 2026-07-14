import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/data/app_api_client.dart';
import 'package:onesign_console/data/console_repository.dart';
import 'package:onesign_console/data/google_auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final consoleRepositoryProvider = Provider((ref) => ConsoleRepository());
final appApiClientProvider = Provider((ref) => AppApiClient());
final googleAuthServiceProvider = Provider((ref) => GoogleAuthService());

final activePlansProvider =
    FutureProvider.autoDispose<List<PlanTemplateInfo>>((ref) async {
  return ref.read(consoleRepositoryProvider).listActivePlans();
});

final authStateProvider = StreamProvider<AuthState>((ref) {
  return supabase.auth.onAuthStateChange;
});

class SessionState {
  const SessionState({
    required this.ownerId,
    required this.workspaces,
    required this.activeWorkspace,
    required this.profile,
    required this.accountDeviceCount,
    this.loading = false,
    this.error,
  });

  final String ownerId;
  final List<WorkspaceInfo> workspaces;
  final WorkspaceInfo activeWorkspace;
  final AccountProfile? profile;
  final int accountDeviceCount;
  final bool loading;
  final String? error;

  SessionState copyWith({
    String? ownerId,
    List<WorkspaceInfo>? workspaces,
    WorkspaceInfo? activeWorkspace,
    AccountProfile? profile,
    int? accountDeviceCount,
    bool? loading,
    String? error,
  }) {
    return SessionState(
      ownerId: ownerId ?? this.ownerId,
      workspaces: workspaces ?? this.workspaces,
      activeWorkspace: activeWorkspace ?? this.activeWorkspace,
      profile: profile ?? this.profile,
      accountDeviceCount: accountDeviceCount ?? this.accountDeviceCount,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

class SessionController extends AsyncNotifier<SessionState?> {
  static const _workspaceKey = 'onesign_active_workspace';

  @override
  Future<SessionState?> build() async {
    final user = supabase.auth.currentUser;
    if (user == null) return null;
    return _loadSession();
  }

  Future<SessionState> _loadSession() async {
    final repo = ref.read(consoleRepositoryProvider);
    await repo.acceptInvitations();
    final ownerId = await repo.primaryAccountId();
    final workspaces = await repo.listWorkspaces();
    if (workspaces.isEmpty) {
      throw StateError('No workspaces available for this account.');
    }

    final prefs = await SharedPreferences.getInstance();
    final savedId = prefs.getString(_workspaceKey);
    WorkspaceInfo active = workspaces.first;
    for (final workspace in workspaces) {
      if (workspace.id == savedId) {
        active = workspace;
        break;
      }
      if (workspace.isDefault) active = workspace;
    }

    final profile = await repo.fetchOwnerProfile(ownerId);
    if (profile?.isDisabled == true) {
      throw StateError('This account is suspended. Contact support.');
    }
    final deviceCount = await repo.accountDeviceCount(ownerId);
    return SessionState(
      ownerId: ownerId,
      workspaces: workspaces,
      activeWorkspace: active,
      profile: profile,
      accountDeviceCount: deviceCount,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_loadSession);
  }

  Future<void> setWorkspace(WorkspaceInfo workspace) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_workspaceKey, workspace.id);
    state = AsyncData(current.copyWith(activeWorkspace: workspace));
    await ref.read(consoleControllerProvider.notifier).reload();
  }

  Future<void> signOut() async {
    await supabase.auth.signOut();
    state = const AsyncData(null);
  }
}

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, SessionState?>(SessionController.new);

class ConsoleController extends AsyncNotifier<ConsoleSnapshot> {
  Timer? _presenceTimer;
  RealtimeChannel? _channel;
  Timer? _debounce;

  static const _ownerTables = [
    'devices',
    'device_groups',
    'playlist_groups',
    'media_groups',
    'playlists',
    'media',
    'websites',
  ];
  static const _unfilteredTables = [
    'device_playlists',
    'device_group_members',
    'playlist_group_members',
    'media_group_members',
    'playlist_items',
  ];

  @override
  Future<ConsoleSnapshot> build() async {
    ref.onDispose(() {
      _presenceTimer?.cancel();
      _debounce?.cancel();
      final channel = _channel;
      _channel = null;
      if (channel != null) {
        unawaited(supabase.removeChannel(channel));
      }
    });
    final session = await ref.watch(sessionControllerProvider.future);
    if (session == null) return ConsoleSnapshot.empty();
    _startPresence();
    _subscribeRealtime(session.ownerId);
    return ref.read(consoleRepositoryProvider).pullConsoleData(
          ownerId: session.ownerId,
          workspaceId: session.activeWorkspace.id,
        );
  }

  void _startPresence() {
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(const Duration(seconds: 25), (_) async {
      try {
        await reload(soft: true);
      } catch (_) {}
    });
  }

  void _subscribeRealtime(String ownerId) {
    final existing = _channel;
    _channel = null;
    if (existing != null) {
      unawaited(supabase.removeChannel(existing));
    }

    var channel = supabase.channel('console-data:$ownerId');

    for (final table in _ownerTables) {
      channel = channel.onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: table,
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'owner_id',
          value: ownerId,
        ),
        callback: (payload) {
          if (table == 'devices' &&
              payload.eventType == PostgresChangeEvent.update) {
            final oldRow = payload.oldRecord;
            final newRow = payload.newRecord;
            if (_isPresenceOnly(oldRow, newRow) && newRow['id'] != null) {
              _patchPresence(
                id: newRow['id'].toString(),
                status: newRow['status']?.toString() ?? 'offline',
                lastSeen: newRow['last_seen'] != null
                    ? DateTime.tryParse(newRow['last_seen'].toString())
                    : null,
              );
              return;
            }
          }
          _scheduleReload();
        },
      );
    }

    for (final table in _unfilteredTables) {
      channel = channel.onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: table,
        callback: (_) => _scheduleReload(),
      );
    }

    _channel = channel.subscribe((status, [_]) {
      if (status == RealtimeSubscribeStatus.subscribed) {
        _scheduleReload();
      }
    });
  }

  bool _isPresenceOnly(
    Map<String, dynamic> oldRow,
    Map<String, dynamic> newRow,
  ) {
    if (oldRow.isEmpty) return false;
    final keys = {...oldRow.keys, ...newRow.keys};
    for (final key in keys) {
      if (key == 'status' || key == 'last_seen') continue;
      if (oldRow[key] != newRow[key]) return false;
    }
    return true;
  }

  void _patchPresence({
    required String id,
    required String status,
    DateTime? lastSeen,
  }) {
    final current = state.valueOrNull;
    if (current == null) return;
    final devices = current.devices
        .map(
          (d) => d.id == id
              ? d.copyWithPresence(status: status, lastSeen: lastSeen)
              : d,
        )
        .toList();
    state = AsyncData(
      ConsoleSnapshot(
        devices: devices,
        deviceGroups: current.deviceGroups,
        playlists: current.playlists,
        media: current.media,
        websites: current.websites,
        playlistItemsByPlaylistId: current.playlistItemsByPlaylistId,
      ),
    );
  }

  void _scheduleReload() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 750), () {
      unawaited(reload(soft: true));
    });
  }

  Future<void> reload({bool soft = false}) async {
    final session = ref.read(sessionControllerProvider).valueOrNull;
    if (session == null) {
      state = AsyncData(ConsoleSnapshot.empty());
      return;
    }
    if (!soft) state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(consoleRepositoryProvider).pullConsoleData(
            ownerId: session.ownerId,
            workspaceId: session.activeWorkspace.id,
          ),
    );
  }
}

final consoleControllerProvider =
    AsyncNotifierProvider<ConsoleController, ConsoleSnapshot>(
  ConsoleController.new,
);

final accountUsersProvider = FutureProvider.autoDispose<List<AccountUser>>((ref) async {
  final session = ref.watch(sessionControllerProvider).valueOrNull;
  if (session == null) return const [];
  return ref.read(consoleRepositoryProvider).listAccountUsers();
});

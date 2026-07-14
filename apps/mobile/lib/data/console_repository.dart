import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ConsoleRepository {
  ConsoleRepository({SupabaseClient? client}) : _client = client ?? supabase;

  final SupabaseClient _client;

  Future<void> acceptInvitations() async {
    try {
      await _client.rpc('accept_account_invitations');
    } catch (_) {
      // No pending invites is fine.
    }
  }

  Future<String> primaryAccountId() async {
    final result = await _client.rpc('primary_account_id');
    if (result is String && result.isNotEmpty) return result;
    final uid = _client.auth.currentUser?.id;
    if (uid == null) throw StateError('Not signed in');
    return uid;
  }

  Future<List<WorkspaceInfo>> listWorkspaces() async {
    final result = await _client.rpc('list_my_workspaces');
    if (result is! List) return const [];
    return result
        .whereType<Map>()
        .map((row) => WorkspaceInfo.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<AccountProfile?> fetchOwnerProfile(String ownerId) async {
    final row = await _client
        .from('profiles')
        .select(
          'id, client_name, device_limit, storage_limit_bytes, storage_used_bytes, trial_ends_at, plan_kind, is_disabled, plan_template_id, stripe_customer_id, subscription_status',
        )
        .eq('id', ownerId)
        .maybeSingle();
    if (row == null) return null;
    return AccountProfile.fromJson(Map<String, dynamic>.from(row));
  }

  Future<List<PlanTemplateInfo>> listActivePlans() async {
    final result = await _client.rpc('list_active_plans');
    return (result as List)
        .whereType<Map>()
        .map((row) => PlanTemplateInfo.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<int> accountDeviceCount(String ownerId) async {
    final rows = await _client.from('devices').select('id').eq('owner_id', ownerId);
    return (rows as List).length;
  }

  Future<ConsoleSnapshot> pullConsoleData({
    required String ownerId,
    required String? workspaceId,
  }) async {
    var devicesBuilder = _client
        .from('devices')
        .select('*, device_playlists(playlist_id,is_active,updated_at)')
        .eq('owner_id', ownerId);
    var groupsBuilder = _client
        .from('device_groups')
        .select('*, device_group_members(device_id)')
        .eq('owner_id', ownerId);
    var playlistsBuilder =
        _client.from('playlists').select('*').eq('owner_id', ownerId);
    var mediaBuilder = _client.from('media').select('*').eq('owner_id', ownerId);
    var websitesBuilder =
        _client.from('websites').select('*').eq('owner_id', ownerId);

    if (workspaceId != null) {
      devicesBuilder = devicesBuilder.eq('workspace_id', workspaceId);
      groupsBuilder = groupsBuilder.eq('workspace_id', workspaceId);
      playlistsBuilder = playlistsBuilder.eq('workspace_id', workspaceId);
      mediaBuilder = mediaBuilder.eq('workspace_id', workspaceId);
      websitesBuilder = websitesBuilder.eq('workspace_id', workspaceId);
    }

    final results = await Future.wait([
      devicesBuilder.order('created_at', ascending: false),
      groupsBuilder.order('created_at', ascending: true),
      playlistsBuilder.order('created_at', ascending: false),
      mediaBuilder.order('created_at', ascending: false),
      websitesBuilder.order('created_at', ascending: false),
    ]);

    final devices = (results[0] as List)
        .map((row) => Device.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();
    final groups = (results[1] as List)
        .map((row) => DeviceGroup.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();
    final playlists = (results[2] as List)
        .map((row) => Playlist.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();
    final media = (results[3] as List)
        .map((row) => MediaItem.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();
    final websites = (results[4] as List)
        .map((row) => WebsiteItem.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList();

    final playlistIds = playlists.map((p) => p.id).toList();
    final itemsByPlaylist = <String, List<PlaylistItem>>{};
    if (playlistIds.isNotEmpty) {
      final itemRows = await _client
          .from('playlist_items')
          .select(
            'id,playlist_id,media_id,website_id,sort_order,duration_seconds,display_from,display_until,daily_schedule_enabled,daily_schedule,created_at,media(*),websites(*)',
          )
          .inFilter('playlist_id', playlistIds)
          .order('sort_order', ascending: true)
          .order('created_at', ascending: true);
      for (final row in itemRows as List) {
        final item =
            PlaylistItem.fromJson(Map<String, dynamic>.from(row as Map));
        itemsByPlaylist.putIfAbsent(item.playlistId, () => []).add(item);
      }
    }

    return ConsoleSnapshot(
      devices: devices,
      deviceGroups: groups,
      playlists: playlists,
      media: media,
      websites: websites,
      playlistItemsByPlaylistId: itemsByPlaylist,
    );
  }

  Future<void> renameDevice({required String deviceId, required String name}) {
    return _client.from('devices').update({'name': name}).eq('id', deviceId);
  }

  Future<void> setPlaybackDisabled({
    required String deviceId,
    required bool disabled,
  }) {
    return _client
        .from('devices')
        .update({'playback_disabled': disabled}).eq('id', deviceId);
  }

  Future<void> deleteDevice(String deviceId) {
    return _client.from('devices').delete().eq('id', deviceId);
  }

  Future<void> linkDeviceByPairingCode({
    required String code,
    required String ownerId,
    required String workspaceId,
    String? name,
  }) async {
    await _client.rpc('link_device_by_pairing_code', params: {
      'p_code': code.trim(),
      'p_name': name,
      'p_owner_id': ownerId,
      'p_workspace_id': workspaceId,
    });
  }

  Future<void> assignPlaylistToDevice({
    required String deviceId,
    required String playlistId,
  }) async {
    final now = DateTime.now().toUtc().toIso8601String();
    await _client.from('device_playlists').upsert(
      {
        'device_id': deviceId,
        'playlist_id': playlistId,
        'is_active': true,
        'updated_at': now,
      },
      onConflict: 'device_id,playlist_id',
    );
    await _client
        .from('device_playlists')
        .update({'is_active': false})
        .eq('device_id', deviceId)
        .neq('playlist_id', playlistId);
  }

  Future<Playlist> createPlaylist({
    required String ownerId,
    required String workspaceId,
    required String name,
  }) async {
    final row = await _client
        .from('playlists')
        .insert({
          'owner_id': ownerId,
          'workspace_id': workspaceId,
          'name': name,
        })
        .select()
        .single();
    return Playlist.fromJson(Map<String, dynamic>.from(row));
  }

  Future<void> deletePlaylist(String playlistId) {
    return _client.from('playlists').delete().eq('id', playlistId);
  }

  Future<void> addMediaToPlaylist({
    required String playlistId,
    required String mediaId,
    required int sortOrder,
    double? durationSeconds,
  }) {
    return _client.from('playlist_items').insert({
      'playlist_id': playlistId,
      'media_id': mediaId,
      'sort_order': sortOrder,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
    });
  }

  Future<void> addWebsiteToPlaylist({
    required String playlistId,
    required String websiteId,
    required int sortOrder,
    double durationSeconds = 30,
  }) {
    return _client.from('playlist_items').insert({
      'playlist_id': playlistId,
      'website_id': websiteId,
      'sort_order': sortOrder,
      'duration_seconds': durationSeconds,
    });
  }

  Future<void> deletePlaylistItem(String itemId) {
    return _client.from('playlist_items').delete().eq('id', itemId);
  }

  Future<DeviceGroup> createDeviceGroup({
    required String ownerId,
    required String workspaceId,
    required String name,
  }) async {
    final row = await _client
        .from('device_groups')
        .insert({
          'owner_id': ownerId,
          'workspace_id': workspaceId,
          'name': name,
        })
        .select()
        .single();
    return DeviceGroup.fromJson(Map<String, dynamic>.from(row));
  }

  Future<void> setGroupMembers({
    required String groupId,
    required List<String> deviceIds,
  }) async {
    await _client.from('device_group_members').delete().eq('group_id', groupId);
    if (deviceIds.isEmpty) return;
    await _client.from('device_group_members').insert(
          deviceIds
              .map((id) => {'group_id': groupId, 'device_id': id})
              .toList(),
        );
  }

  Future<void> deleteDeviceGroup(String groupId) {
    return _client.from('device_groups').delete().eq('id', groupId);
  }

  Future<void> deleteMedia(String mediaId) {
    return _client.from('media').delete().eq('id', mediaId);
  }

  Future<void> deleteWebsite(String websiteId) {
    return _client.from('websites').delete().eq('id', websiteId);
  }

  Future<void> rebindDevice({
    required String deviceId,
    required String code,
    required String ownerId,
    bool allowPlatformChange = false,
  }) {
    return _client.rpc('rebind_device_by_pairing_code', params: {
      'p_device_id': deviceId,
      'p_code': code.trim(),
      'p_owner_id': ownerId,
      'p_allow_platform_change': allowPlatformChange,
    });
  }

  Future<void> updateDeviceTags({
    required String deviceId,
    required List<String> tags,
  }) {
    return _client.from('devices').update({'tags': tags}).eq('id', deviceId);
  }

  Future<void> updateOperatingHours({
    required String deviceId,
    required Map<String, dynamic> operatingHours,
    required String timezone,
    required bool inverted,
    required bool blankWhenOffHours,
  }) {
    return _client.from('devices').update({
      'operating_hours': operatingHours,
      'operating_hours_timezone': timezone,
      'operating_hours_inverted': inverted,
      'blank_when_off_hours': blankWhenOffHours,
      'operating_hours_timezone_auto': false,
    }).eq('id', deviceId);
  }

  Future<void> updatePlaylistItemSchedule({
    required String itemId,
    required bool enabled,
    Map<String, dynamic>? schedule,
    DateTime? displayFrom,
    DateTime? displayUntil,
  }) {
    return _client.from('playlist_items').update({
      'daily_schedule_enabled': enabled,
      'daily_schedule': enabled ? (schedule ?? defaultWeeklySchedule()) : null,
      'display_from': displayFrom?.toUtc().toIso8601String(),
      'display_until': displayUntil?.toUtc().toIso8601String(),
    }).eq('id', itemId);
  }

  Future<List<AccountUser>> listAccountUsers() async {
    final result = await _client.rpc('list_account_users');
    if (result is! List) return const [];
    return result
        .whereType<Map>()
        .map((row) => AccountUser.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> requestLiveScreenshot(String deviceId) {
    return _client.rpc('request_device_live_screenshot', params: {
      'p_device_id': deviceId,
    });
  }
}

import 'package:onesign_console/core/workspace_name.dart';

class WorkspaceInfo {
  WorkspaceInfo({
    required this.id,
    required this.name,
    required this.isDefault,
    required this.role,
    required this.permissions,
  });

  final String id;
  final String name;
  final bool isDefault;
  final String role;
  final List<String> permissions;

  factory WorkspaceInfo.fromJson(Map<String, dynamic> json) {
    final perms = json['permissions'];
    return WorkspaceInfo(
      id: json['id'] as String,
      name: displayWorkspaceName(json['name'] as String?),
      isDefault: json['is_default'] == true,
      role: (json['role'] as String?) ?? 'standard',
      permissions: perms is List
          ? perms.map((e) => e.toString()).toList()
          : const <String>[],
    );
  }

  bool hasPermission(String permission) {
    if (role == 'owner' ||
        role == 'account_admin' ||
        role == 'admin' ||
        permissions.contains('administrator')) {
      return true;
    }
    return permissions.contains(permission);
  }
}

class DevicePlaylistAssignment {
  DevicePlaylistAssignment({
    required this.playlistId,
    required this.isActive,
    this.updatedAt,
  });

  final String playlistId;
  final bool isActive;
  final DateTime? updatedAt;

  factory DevicePlaylistAssignment.fromJson(Map<String, dynamic> json) {
    return DevicePlaylistAssignment(
      playlistId: json['playlist_id'] as String,
      isActive: json['is_active'] == true,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
    );
  }
}

class Device {
  Device({
    required this.id,
    required this.ownerId,
    required this.workspaceId,
    required this.publicCode,
    required this.name,
    required this.status,
    required this.platform,
    required this.createdAt,
    this.pairingCode,
    this.description,
    this.lastSeen,
    this.playbackDisabled = false,
    this.pausedByQuota = false,
    this.screenOrientation,
    this.tags = const [],
    this.operatingHours,
    this.operatingHoursTimezone,
    this.operatingHoursInverted = false,
    this.blankWhenOffHours = false,
    this.assignments = const [],
  });

  final String id;
  final String ownerId;
  final String? workspaceId;
  final String publicCode;
  final String name;
  final String status;
  final String platform;
  final DateTime createdAt;
  final String? pairingCode;
  final String? description;
  final DateTime? lastSeen;
  final bool playbackDisabled;
  final bool pausedByQuota;
  final String? screenOrientation;
  final List<String> tags;
  final Map<String, dynamic>? operatingHours;
  final String? operatingHoursTimezone;
  final bool operatingHoursInverted;
  final bool blankWhenOffHours;
  final List<DevicePlaylistAssignment> assignments;

  Device copyWithPresence({String? status, DateTime? lastSeen}) {
    return Device(
      id: id,
      ownerId: ownerId,
      workspaceId: workspaceId,
      publicCode: publicCode,
      name: name,
      status: status ?? this.status,
      platform: platform,
      createdAt: createdAt,
      pairingCode: pairingCode,
      description: description,
      lastSeen: lastSeen ?? this.lastSeen,
      playbackDisabled: playbackDisabled,
      pausedByQuota: pausedByQuota,
      screenOrientation: screenOrientation,
      tags: tags,
      operatingHours: operatingHours,
      operatingHoursTimezone: operatingHoursTimezone,
      operatingHoursInverted: operatingHoursInverted,
      blankWhenOffHours: blankWhenOffHours,
      assignments: assignments,
    );
  }

  String? get activePlaylistId {
    for (final a in assignments) {
      if (a.isActive) return a.playlistId;
    }
    return null;
  }

  factory Device.fromJson(Map<String, dynamic> json) {
    final raw = json['device_playlists'];
    final assignments = <DevicePlaylistAssignment>[];
    if (raw is List) {
      for (final row in raw) {
        if (row is Map<String, dynamic>) {
          assignments.add(DevicePlaylistAssignment.fromJson(row));
        }
      }
    }
    return Device(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      workspaceId: json['workspace_id'] as String?,
      publicCode: (json['public_code'] as String?) ?? '',
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? (json['name'] as String).trim()
          : 'Untitled screen',
      status: (json['status'] as String?) ?? 'offline',
      platform: (json['platform'] as String?) ?? 'android',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      pairingCode: json['pairing_code'] as String?,
      description: json['description'] as String?,
      lastSeen: json['last_seen'] != null
          ? DateTime.tryParse(json['last_seen'] as String)
          : null,
      playbackDisabled: json['playback_disabled'] == true,
      pausedByQuota: json['paused_by_quota'] == true,
      screenOrientation: json['screen_orientation'] as String?,
      tags: (json['tags'] is List)
          ? (json['tags'] as List).map((e) => e.toString()).toList()
          : const [],
      operatingHours: json['operating_hours'] is Map
          ? Map<String, dynamic>.from(json['operating_hours'] as Map)
          : null,
      operatingHoursTimezone: json['operating_hours_timezone'] as String?,
      operatingHoursInverted: json['operating_hours_inverted'] == true,
      blankWhenOffHours: json['blank_when_off_hours'] == true,
      assignments: assignments,
    );
  }
}

class Playlist {
  Playlist({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.createdAt,
    this.workspaceId,
  });

  final String id;
  final String ownerId;
  final String? workspaceId;
  final String name;
  final DateTime createdAt;

  factory Playlist.fromJson(Map<String, dynamic> json) {
    return Playlist(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      workspaceId: json['workspace_id'] as String?,
      name: (json['name'] as String?) ?? 'Playlist',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class MediaItem {
  MediaItem({
    required this.id,
    required this.ownerId,
    required this.fileType,
    required this.createdAt,
    this.workspaceId,
    this.storagePath,
    this.originalFilename,
    this.sizeBytes,
    this.durationSeconds,
    this.description,
  });

  final String id;
  final String ownerId;
  final String? workspaceId;
  final String fileType;
  final DateTime createdAt;
  final String? storagePath;
  final String? originalFilename;
  final int? sizeBytes;
  final double? durationSeconds;
  final String? description;

  String get displayName =>
      (originalFilename?.trim().isNotEmpty == true)
          ? originalFilename!.trim()
          : 'Media';

  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      workspaceId: json['workspace_id'] as String?,
      fileType: (json['file_type'] as String?) ?? 'unknown',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      storagePath: json['storage_path'] as String?,
      originalFilename: json['original_filename'] as String?,
      sizeBytes: (json['size_bytes'] as num?)?.toInt(),
      durationSeconds: (json['duration_seconds'] as num?)?.toDouble(),
      description: json['description'] as String?,
    );
  }
}

class WebsiteItem {
  WebsiteItem({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.sourceType,
    required this.createdAt,
    this.workspaceId,
    this.url,
    this.playbackUrl,
    this.description,
  });

  final String id;
  final String ownerId;
  final String? workspaceId;
  final String name;
  final String sourceType;
  final DateTime createdAt;
  final String? url;
  final String? playbackUrl;
  final String? description;

  factory WebsiteItem.fromJson(Map<String, dynamic> json) {
    return WebsiteItem(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      workspaceId: json['workspace_id'] as String?,
      name: (json['name'] as String?) ?? 'Website',
      sourceType: (json['source_type'] as String?) ?? 'url',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      url: json['url'] as String?,
      playbackUrl: json['playback_url'] as String?,
      description: json['description'] as String?,
    );
  }
}

class DeviceGroup {
  DeviceGroup({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.createdAt,
    this.workspaceId,
    this.accentColor,
    this.playlistId,
    this.memberDeviceIds = const [],
  });

  final String id;
  final String ownerId;
  final String? workspaceId;
  final String name;
  final DateTime createdAt;
  final String? accentColor;
  final String? playlistId;
  final List<String> memberDeviceIds;

  factory DeviceGroup.fromJson(Map<String, dynamic> json) {
    final members = json['device_group_members'];
    final ids = <String>[];
    if (members is List) {
      for (final m in members) {
        if (m is Map && m['device_id'] != null) {
          ids.add(m['device_id'].toString());
        }
      }
    }
    return DeviceGroup(
      id: json['id'] as String,
      ownerId: json['owner_id'] as String,
      workspaceId: json['workspace_id'] as String?,
      name: (json['name'] as String?) ?? 'Group',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      accentColor: json['accent_color'] as String?,
      playlistId: json['playlist_id'] as String?,
      memberDeviceIds: ids,
    );
  }
}

class PlaylistItem {
  PlaylistItem({
    required this.id,
    required this.playlistId,
    required this.sortOrder,
    required this.createdAt,
    this.mediaId,
    this.websiteId,
    this.durationSeconds,
    this.displayFrom,
    this.displayUntil,
    this.dailyScheduleEnabled = false,
    this.dailySchedule,
    this.media,
    this.website,
  });

  final String id;
  final String playlistId;
  final int sortOrder;
  final DateTime createdAt;
  final String? mediaId;
  final String? websiteId;
  final double? durationSeconds;
  final DateTime? displayFrom;
  final DateTime? displayUntil;
  final bool dailyScheduleEnabled;
  final Map<String, dynamic>? dailySchedule;
  final MediaItem? media;
  final WebsiteItem? website;

  String get title {
    if (media != null) return media!.displayName;
    if (website != null) return website!.name;
    return 'Item';
  }

  factory PlaylistItem.fromJson(Map<String, dynamic> json) {
    MediaItem? media;
    WebsiteItem? website;
    final mediaRaw = json['media'];
    final websiteRaw = json['websites'];
    if (mediaRaw is Map<String, dynamic>) {
      media = MediaItem.fromJson(mediaRaw);
    } else if (mediaRaw is List && mediaRaw.isNotEmpty && mediaRaw.first is Map) {
      media = MediaItem.fromJson(Map<String, dynamic>.from(mediaRaw.first as Map));
    }
    if (websiteRaw is Map<String, dynamic>) {
      website = WebsiteItem.fromJson(websiteRaw);
    } else if (websiteRaw is List &&
        websiteRaw.isNotEmpty &&
        websiteRaw.first is Map) {
      website =
          WebsiteItem.fromJson(Map<String, dynamic>.from(websiteRaw.first as Map));
    }
    return PlaylistItem(
      id: json['id'] as String,
      playlistId: json['playlist_id'] as String,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      mediaId: json['media_id'] as String?,
      websiteId: json['website_id'] as String?,
      durationSeconds: (json['duration_seconds'] as num?)?.toDouble(),
      displayFrom: json['display_from'] != null
          ? DateTime.tryParse(json['display_from'] as String)
          : null,
      displayUntil: json['display_until'] != null
          ? DateTime.tryParse(json['display_until'] as String)
          : null,
      dailyScheduleEnabled: json['daily_schedule_enabled'] == true,
      dailySchedule: json['daily_schedule'] is Map
          ? Map<String, dynamic>.from(json['daily_schedule'] as Map)
          : null,
      media: media,
      website: website,
    );
  }
}

class AccountUser {
  AccountUser({
    required this.email,
    required this.isOwner,
    required this.invitationPending,
    this.userId,
    this.displayName,
    this.workspaceRoles = const [],
  });

  final String? userId;
  final String email;
  final String? displayName;
  final bool isOwner;
  final bool invitationPending;
  final List<Map<String, dynamic>> workspaceRoles;

  factory AccountUser.fromJson(Map<String, dynamic> json) {
    final roles = json['workspace_roles'];
    return AccountUser(
      userId: json['user_id'] as String?,
      email: (json['email'] as String?) ?? '',
      displayName: json['display_name'] as String?,
      isOwner: json['is_owner'] == true,
      invitationPending: json['invitation_pending'] == true,
      workspaceRoles: roles is List
          ? roles
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : const [],
    );
  }
}

Map<String, dynamic> defaultWeeklySchedule() {
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  return {
    for (final day in days) day: {'start': '00:00', 'end': '23:59'},
  };
}

class AccountProfile {
  AccountProfile({
    required this.id,
    this.clientName,
    this.deviceLimit = 1,
    this.storageLimitBytes = 0,
    this.storageUsedBytes = 0,
    this.trialEndsAt,
    this.planKind,
    this.isDisabled = false,
    this.planTemplateId,
    this.stripeCustomerId,
    this.subscriptionStatus,
  });

  final String id;
  final String? clientName;
  final int deviceLimit;
  final int storageLimitBytes;
  final int storageUsedBytes;
  final DateTime? trialEndsAt;
  final String? planKind;
  final bool isDisabled;
  final String? planTemplateId;
  final String? stripeCustomerId;
  final String? subscriptionStatus;

  bool get isOnTrial {
    if (planKind != 'trial') return false;
    final ends = trialEndsAt;
    if (ends == null) return true;
    return ends.isAfter(DateTime.now());
  }

  bool get hasStripeCustomer =>
      stripeCustomerId != null && stripeCustomerId!.trim().isNotEmpty;

  factory AccountProfile.fromJson(Map<String, dynamic> json) {
    return AccountProfile(
      id: json['id'] as String,
      clientName: json['client_name'] as String?,
      deviceLimit: (json['device_limit'] as num?)?.toInt() ?? 1,
      storageLimitBytes: (json['storage_limit_bytes'] as num?)?.toInt() ?? 0,
      storageUsedBytes: (json['storage_used_bytes'] as num?)?.toInt() ?? 0,
      trialEndsAt: json['trial_ends_at'] != null
          ? DateTime.tryParse(json['trial_ends_at'] as String)
          : null,
      planKind: json['plan_kind'] as String?,
      isDisabled: json['is_disabled'] == true,
      planTemplateId: json['plan_template_id'] as String?,
      stripeCustomerId: json['stripe_customer_id'] as String?,
      subscriptionStatus: json['subscription_status'] as String?,
    );
  }
}

class PlanTemplateInfo {
  PlanTemplateInfo({
    required this.id,
    required this.name,
    required this.tagline,
    required this.deviceLimit,
    required this.storageLimitBytes,
    required this.monthlyPriceCents,
    required this.annualMonthlyPriceCents,
    required this.ctaLabel,
    required this.features,
    required this.isHighlighted,
    this.badge,
    this.originalPriceCents,
    this.stripePriceMonthlyId,
    this.stripePriceAnnualId,
  });

  final String id;
  final String name;
  final String tagline;
  final int deviceLimit;
  final int storageLimitBytes;
  final int monthlyPriceCents;
  final int annualMonthlyPriceCents;
  final int? originalPriceCents;
  final String ctaLabel;
  final List<String> features;
  final String? badge;
  final bool isHighlighted;
  final String? stripePriceMonthlyId;
  final String? stripePriceAnnualId;

  bool get isBillable => monthlyPriceCents > 0;

  bool get hasStripePrice =>
      (stripePriceMonthlyId != null && stripePriceMonthlyId!.isNotEmpty) ||
      (stripePriceAnnualId != null && stripePriceAnnualId!.isNotEmpty);

  List<String> get marketingFeatures => features
      .where((f) => !f.trim().toLowerCase().startsWith('entitlement:'))
      .toList(growable: false);

  factory PlanTemplateInfo.fromJson(Map<String, dynamic> json) {
    final features = json['features'];
    return PlanTemplateInfo(
      id: json['id'] as String,
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? (json['name'] as String).trim()
          : 'Plan',
      tagline: (json['tagline'] as String?) ?? '',
      deviceLimit: (json['device_limit'] as num?)?.toInt() ?? 1,
      storageLimitBytes: (json['storage_limit_bytes'] as num?)?.toInt() ?? 0,
      monthlyPriceCents: (json['monthly_price_cents'] as num?)?.toInt() ?? 0,
      annualMonthlyPriceCents:
          (json['annual_monthly_price_cents'] as num?)?.toInt() ?? 0,
      originalPriceCents: (json['original_price_cents'] as num?)?.toInt(),
      ctaLabel: (json['cta_label'] as String?)?.trim().isNotEmpty == true
          ? (json['cta_label'] as String).trim()
          : 'Choose plan',
      features: features is List
          ? features.map((e) => e.toString()).toList(growable: false)
          : const <String>[],
      badge: json['badge'] as String?,
      isHighlighted: json['is_highlighted'] == true,
      stripePriceMonthlyId: json['stripe_price_monthly_id'] as String?,
      stripePriceAnnualId: json['stripe_price_annual_id'] as String?,
    );
  }
}

class ConsoleSnapshot {
  ConsoleSnapshot({
    required this.devices,
    required this.deviceGroups,
    required this.playlists,
    required this.media,
    required this.websites,
    required this.playlistItemsByPlaylistId,
  });

  final List<Device> devices;
  final List<DeviceGroup> deviceGroups;
  final List<Playlist> playlists;
  final List<MediaItem> media;
  final List<WebsiteItem> websites;
  final Map<String, List<PlaylistItem>> playlistItemsByPlaylistId;

  static ConsoleSnapshot empty() => ConsoleSnapshot(
        devices: const [],
        deviceGroups: const [],
        playlists: const [],
        media: const [],
        websites: const [],
        playlistItemsByPlaylistId: const {},
      );

  int get onlineCount =>
      devices.where((d) => effectiveDeviceStatus(d) == 'online').length;
}

const staleOnlineMs = 90000;

String effectiveDeviceStatus(Device device) {
  if (device.status == 'pending_pairing') return 'pending_pairing';
  if (device.status == 'offline') return 'offline';
  if (device.lastSeen != null) {
    final ageMs = DateTime.now().difference(device.lastSeen!).inMilliseconds;
    if (ageMs <= staleOnlineMs) return 'online';
  }
  if (device.status == 'online') return 'offline';
  return device.status;
}

String formatDeviceLastSeen(DateTime? lastSeen) {
  if (lastSeen == null) return 'Never seen';
  final diffMs = DateTime.now().difference(lastSeen).inMilliseconds;
  final sec = diffMs ~/ 1000;
  final min = sec ~/ 60;
  final hr = min ~/ 60;
  final day = hr ~/ 24;
  if (day > 30) {
    return '${lastSeen.day}/${lastSeen.month}/${lastSeen.year}';
  }
  if (day > 0) return day == 1 ? 'Yesterday' : '$day days ago';
  if (hr > 0) return '${hr}h ago';
  if (min > 0) return '${min}m ago';
  if (diffMs > staleOnlineMs) return '${sec}s ago';
  return 'Just now';
}

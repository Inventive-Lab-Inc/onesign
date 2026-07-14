import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

class ScreensPage extends ConsumerWidget {
  const ScreensPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showPairDialog(context, ref),
        icon: const Icon(Icons.link),
        label: const Text('Pair screen'),
      ),
      body: console.when(
        loading: () => const LoadingBody(),
        error: (e, _) => ErrorBody(
          message: e.toString(),
          onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
        ),
        data: (snap) {
          if (snap.devices.isEmpty) {
            return EmptyState(
              title: 'No screens yet',
              subtitle: 'Open the OneSign TV app and enter the pairing code here.',
              action: FilledButton(
                onPressed: () => _showPairDialog(context, ref),
                child: const Text('Pair screen'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(consoleControllerProvider.notifier).reload(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
              itemCount: snap.devices.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final device = snap.devices[index];
                final status = effectiveDeviceStatus(device);
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(device.name),
                  subtitle: Text(
                    '${device.platform} · ${playlistNameForDevice(device, snap)}\n${formatDeviceLastSeen(device.lastSeen)}',
                  ),
                  isThreeLine: true,
                  trailing: StatusChip(status: status),
                  onTap: () => context.push('/screens/${device.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

Future<void> _showPairDialog(BuildContext context, WidgetRef ref) async {
  final codeController = TextEditingController();
  final nameController = TextEditingController();
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;

  final ok = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text('Pair screen'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: codeController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              decoration: const InputDecoration(
                labelText: '6-digit code',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Name (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Pair'),
          ),
        ],
      );
    },
  );

  if (ok != true || !context.mounted) return;
  try {
    await ref.read(consoleRepositoryProvider).linkDeviceByPairingCode(
          code: codeController.text,
          ownerId: session.ownerId,
          workspaceId: session.activeWorkspace.id,
          name: nameController.text.trim().isEmpty
              ? null
              : nameController.text.trim(),
        );
    await ref.read(consoleControllerProvider.notifier).reload();
    await ref.read(sessionControllerProvider.notifier).refresh();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Screen paired')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }
}

class ScreenDetailPage extends ConsumerWidget {
  const ScreenDetailPage({super.key, required this.deviceId});

  final String deviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return console.when(
      loading: () => const Scaffold(body: LoadingBody()),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: ErrorBody(
          message: e.toString(),
          onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
        ),
      ),
      data: (snap) {
        final device = snap.devices.cast<Device?>().firstWhere(
              (d) => d?.id == deviceId,
              orElse: () => null,
            );
        if (device == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyState(
              title: 'Screen not found',
              subtitle: 'It may have been removed or is in another workspace.',
            ),
          );
        }
        final status = effectiveDeviceStatus(device);
        return Scaffold(
          appBar: AppBar(
            title: Text(device.name),
            actions: [
              PopupMenuButton<String>(
                onSelected: (value) async {
                  if (value == 'rename') {
                    await _rename(context, ref, device);
                  } else if (value == 'repair') {
                    await _rePair(context, ref, device);
                  } else if (value == 'screenshot') {
                    try {
                      await ref
                          .read(consoleRepositoryProvider)
                          .requestLiveScreenshot(device.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Screenshot requested')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('$e')),
                        );
                      }
                    }
                  } else if (value == 'delete') {
                    await _delete(context, ref, device);
                  }
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(value: 'rename', child: Text('Rename')),
                  PopupMenuItem(value: 'repair', child: Text('Re-pair device')),
                  PopupMenuItem(
                    value: 'screenshot',
                    child: Text('Request live screenshot'),
                  ),
                  PopupMenuItem(value: 'delete', child: Text('Delete')),
                ],
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  StatusChip(status: status),
                  const SizedBox(width: 12),
                  Text(formatDeviceLastSeen(device.lastSeen)),
                ],
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Platform'),
                subtitle: Text(device.platform),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Playlist'),
                subtitle: Text(playlistNameForDevice(device, snap)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _pickPlaylist(context, ref, device, snap),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tags'),
                subtitle: Text(
                  device.tags.isEmpty ? 'No tags' : device.tags.join(', '),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _editTags(context, ref, device),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Operating hours'),
                subtitle: Text(
                  device.operatingHours == null
                      ? 'All day'
                      : '${device.operatingHoursTimezone ?? 'Local'}${device.operatingHoursInverted ? ' · outside window' : ''}',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _editHours(context, ref, device),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Playback enabled'),
                value: !device.playbackDisabled,
                onChanged: (enabled) async {
                  try {
                    await ref.read(consoleRepositoryProvider).setPlaybackDisabled(
                          deviceId: device.id,
                          disabled: !enabled,
                        );
                    await ref.read(consoleControllerProvider.notifier).reload();
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('$e')),
                      );
                    }
                  }
                },
              ),
              if (device.description?.trim().isNotEmpty == true)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Description'),
                  subtitle: Text(device.description!),
                ),
            ],
          ),
        );
      },
    );
  }
}

Future<void> _rename(
  BuildContext context,
  WidgetRef ref,
  Device device,
) async {
  final controller = TextEditingController(text: device.name);
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Rename screen'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(border: OutlineInputBorder()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  await ref.read(consoleRepositoryProvider).renameDevice(
        deviceId: device.id,
        name: controller.text.trim(),
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

Future<void> _delete(
  BuildContext context,
  WidgetRef ref,
  Device device,
) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Delete screen?'),
      content: Text('Remove ${device.name} from this account.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;
  await ref.read(consoleRepositoryProvider).deleteDevice(device.id);
  await ref.read(consoleControllerProvider.notifier).reload();
  if (context.mounted) context.pop();
}

Future<void> _rePair(
  BuildContext context,
  WidgetRef ref,
  Device device,
) async {
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;
  final codeController = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Re-pair device'),
      content: TextField(
        controller: codeController,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        decoration: const InputDecoration(
          labelText: 'New 6-digit code',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Reconnect'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  try {
    await ref.read(consoleRepositoryProvider).rebindDevice(
          deviceId: device.id,
          code: codeController.text,
          ownerId: session.ownerId,
        );
    await ref.read(consoleControllerProvider.notifier).reload();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Device re-paired')),
      );
    }
  } catch (e) {
    final message = e.toString();
    if (message.toLowerCase().contains('platform') && context.mounted) {
      final allow = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Platform mismatch'),
          content: const Text(
            'This pairing code is for a different platform. Allow platform change?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Allow'),
            ),
          ],
        ),
      );
      if (allow == true) {
        await ref.read(consoleRepositoryProvider).rebindDevice(
              deviceId: device.id,
              code: codeController.text,
              ownerId: session.ownerId,
              allowPlatformChange: true,
            );
        await ref.read(consoleControllerProvider.notifier).reload();
      }
      return;
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    }
  }
}

Future<void> _editTags(
  BuildContext context,
  WidgetRef ref,
  Device device,
) async {
  final controller = TextEditingController(text: device.tags.join(', '));
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Tags'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(
          labelText: 'Comma-separated tags',
          border: OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  final tags = controller.text
      .split(',')
      .map((t) => t.trim())
      .where((t) => t.isNotEmpty)
      .toList();
  await ref.read(consoleRepositoryProvider).updateDeviceTags(
        deviceId: device.id,
        tags: tags,
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

Future<void> _editHours(
  BuildContext context,
  WidgetRef ref,
  Device device,
) async {
  var inverted = device.operatingHoursInverted;
  var blank = device.blankWhenOffHours;
  final tzController = TextEditingController(
    text: device.operatingHoursTimezone ?? 'UTC',
  );
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Operating hours'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: tzController,
                decoration: const InputDecoration(
                  labelText: 'Timezone (IANA)',
                  border: OutlineInputBorder(),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Active outside window'),
                value: inverted,
                onChanged: (v) => setState(() => inverted = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Blank when off hours'),
                value: blank,
                onChanged: (v) => setState(() => blank = v),
              ),
              const Text(
                'Applies an all-day schedule (00:00–23:59). Fine-tune day windows on web if needed.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save'),
            ),
          ],
        ),
      );
    },
  );
  if (ok != true) return;
  await ref.read(consoleRepositoryProvider).updateOperatingHours(
        deviceId: device.id,
        operatingHours: device.operatingHours ?? defaultWeeklySchedule(),
        timezone: tzController.text.trim().isEmpty
            ? 'UTC'
            : tzController.text.trim(),
        inverted: inverted,
        blankWhenOffHours: blank,
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

Future<void> _pickPlaylist(
  BuildContext context,
  WidgetRef ref,
  Device device,
  ConsoleSnapshot snap,
) async {
  final selected = await showModalBottomSheet<String>(
    context: context,
    builder: (context) {
      return SafeArea(
        child: ListView(
          children: [
            const ListTile(title: Text('Assign playlist')),
            ...snap.playlists.map(
              (p) => ListTile(
                title: Text(p.name),
                trailing: device.activePlaylistId == p.id
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => Navigator.pop(context, p.id),
              ),
            ),
          ],
        ),
      );
    },
  );
  if (selected == null) return;
  await ref.read(consoleRepositoryProvider).assignPlaylistToDevice(
        deviceId: device.id,
        playlistId: selected,
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

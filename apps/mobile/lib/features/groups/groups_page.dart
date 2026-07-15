import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

class GroupsPage extends ConsumerWidget {
  const GroupsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return console.when(
      loading: () => const Scaffold(body: LoadingBody()),
      error: (e, _) => Scaffold(
        body: ErrorBody(
          error: e,
          onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
        ),
      ),
      data: (snap) {
        final isEmpty = snap.deviceGroups.isEmpty;
        return Scaffold(
          floatingActionButton: isEmpty
              ? null
              : FloatingActionButton.extended(
                  heroTag: 'fab-groups-create',
                  onPressed: () => _createGroup(context, ref),
                  icon: const Icon(Icons.add),
                  label: const Text('Group'),
                ),
          body: isEmpty
              ? EmptyState(
                  title: 'No groups',
                  subtitle: 'Group screens to manage them together.',
                  action: FilledButton(
                    onPressed: () => _createGroup(context, ref),
                    child: const Text('Create group'),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () =>
                      ref.read(consoleControllerProvider.notifier).reload(),
                  child: ListView.separated(
                    padding: Responsive.listPadding(context, fab: true),
                    itemCount: snap.deviceGroups.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final group = snap.deviceGroups[index];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(group.name),
                        subtitle:
                            Text('${group.memberDeviceIds.length} screens'),
                        trailing: IconButton(
                          icon: const Icon(Icons.edit_outlined),
                          onPressed: () =>
                              _editMembers(context, ref, snap, group),
                        ),
                        onLongPress: () async {
                          await ref
                              .read(consoleRepositoryProvider)
                              .deleteDeviceGroup(group.id);
                          await ref
                              .read(consoleControllerProvider.notifier)
                              .reload();
                        },
                      );
                    },
                  ),
                ),
        );
      },
    );
  }
}

Future<void> _createGroup(BuildContext context, WidgetRef ref) async {
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;
  final controller = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('New group'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(
          labelText: 'Name',
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
          child: const Text('Create'),
        ),
      ],
    ),
  );
  if (ok != true || controller.text.trim().isEmpty) return;
  final group = await ref.read(consoleRepositoryProvider).createDeviceGroup(
        ownerId: session.ownerId,
        workspaceId: session.activeWorkspace.id,
        name: controller.text.trim(),
      );
  await ref.read(consoleControllerProvider.notifier).reload();
  if (!context.mounted) return;
  final snap = ref.read(consoleControllerProvider).valueOrNull;
  if (snap != null) {
    await _editMembers(context, ref, snap, group);
  }
}

Future<void> _editMembers(
  BuildContext context,
  WidgetRef ref,
  ConsoleSnapshot snap,
  DeviceGroup group,
) async {
  final selected = {...group.memberDeviceIds};
  final refreshed = await showModalBottomSheet<Set<String>>(
    context: context,
    isScrollControlled: true,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          return SafeArea(
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height *
                  Responsive.sheetHeightFactor(context),
              child: Column(
                children: [
                  ListTile(
                    title: Text('Screens in ${group.name}'),
                    trailing: TextButton(
                      onPressed: () => Navigator.pop(context, selected),
                      child: const Text('Save'),
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      children: snap.devices.map((d) {
                        final checked = selected.contains(d.id);
                        return CheckboxListTile(
                          value: checked,
                          title: Text(d.name),
                          onChanged: (v) {
                            setState(() {
                              if (v == true) {
                                selected.add(d.id);
                              } else {
                                selected.remove(d.id);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
  if (refreshed == null) return;
  await ref.read(consoleRepositoryProvider).setGroupMembers(
        groupId: group.id,
        deviceIds: refreshed.toList(),
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

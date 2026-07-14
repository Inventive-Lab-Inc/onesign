import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).valueOrNull;
    final console = ref.watch(consoleControllerProvider);

    return console.when(
      loading: () => const LoadingBody(),
      error: (e, _) => ErrorBody(
        message: e.toString(),
        onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
      ),
      data: (snap) {
        final profile = session?.profile;
        final storageUsed = profile?.storageUsedBytes ?? 0;
        final storageLimit = profile?.storageLimitBytes ?? 0;
        final deviceLimit = profile?.deviceLimit ?? 0;
        final accountDevices = session?.accountDeviceCount ?? snap.devices.length;

        return RefreshIndicator(
          onRefresh: () => ref.read(consoleControllerProvider.notifier).reload(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                profile?.clientName?.trim().isNotEmpty == true
                    ? profile!.clientName!
                    : 'Dashboard',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 4),
              Text(
                session?.activeWorkspace.name ?? '',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _StatCard(
                    label: 'Screens',
                    value: '${snap.devices.length}',
                    hint: '$accountDevices / $deviceLimit account',
                  ),
                  _StatCard(
                    label: 'Online',
                    value: '${snap.onlineCount}',
                    hint: 'this workspace',
                  ),
                  _StatCard(
                    label: 'Content',
                    value: '${snap.media.length}',
                    hint: 'media files',
                  ),
                  _StatCard(
                    label: 'Storage',
                    value: _formatBytes(storageUsed),
                    hint: storageLimit > 0
                        ? 'of ${_formatBytes(storageLimit)}'
                        : 'used',
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Text('Screens', style: Theme.of(context).textTheme.titleMedium),
                  const Spacer(),
                  TextButton(
                    onPressed: () => context.go('/screens'),
                    child: const Text('See all'),
                  ),
                ],
              ),
              if (snap.devices.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('No screens in this workspace yet.'),
                )
              else
                ...snap.devices.take(5).map((d) {
                  final status = effectiveDeviceStatus(d);
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(d.name),
                    subtitle: Text(formatDeviceLastSeen(d.lastSeen)),
                    trailing: StatusChip(status: status),
                    onTap: () => context.push('/screens/${d.id}'),
                  );
                }),
            ],
          ),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.hint,
  });

  final String label;
  final String value;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final width = (MediaQuery.sizeOf(context).width - 44) / 2;
    return SizedBox(
      width: width,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Text(value, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 2),
              Text(
                hint,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return '${value.toStringAsFixed(value >= 10 || i == 0 ? 0 : 1)} ${units[i]}';
}

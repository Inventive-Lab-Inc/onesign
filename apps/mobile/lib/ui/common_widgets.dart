import 'package:flutter/material.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/core/user_facing_error.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      'online' => ('Online', Brand.theme),
      'pending_pairing' => ('Pairing', Colors.orange.shade800),
      _ => ('Offline', Brand.neutral500),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    this.action,
  });

  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitleStyle = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final titleWidget = Text(title, style: theme.textTheme.titleMedium);
    final subtitleWidget = Text(subtitle, style: subtitleStyle);

    // Use width for copy + CTA instead of a tall centered stack.
    if (action != null && Responsive.useWideEmptyState(context)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      titleWidget,
                      const SizedBox(height: 6),
                      subtitleWidget,
                    ],
                  ),
                ),
                const SizedBox(width: 24),
                action!,
              ],
            ),
          ),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            titleWidget,
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: subtitleStyle,
            ),
            if (action != null) ...[
              const SizedBox(height: 16),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorBody extends StatelessWidget {
  const ErrorBody({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      title: 'Something went wrong',
      subtitle: userFacingError(
        error,
        fallback: 'We couldn’t load this screen. Please try again.',
      ),
      action: FilledButton(onPressed: onRetry, child: const Text('Retry')),
    );
  }
}

class LoadingBody extends StatelessWidget {
  const LoadingBody({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

String playlistNameForDevice(Device device, ConsoleSnapshot snapshot) {
  final id = device.activePlaylistId;
  if (id == null) return 'No playlist';
  for (final p in snapshot.playlists) {
    if (p.id == id) return p.name;
  }
  return 'Playlist';
}

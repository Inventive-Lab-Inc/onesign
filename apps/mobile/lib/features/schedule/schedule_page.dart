import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

/// Compact schedule overview of playlist items with windows / daily times.
class SchedulePage extends ConsumerWidget {
  const SchedulePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule')),
      body: console.when(
        loading: () => const LoadingBody(),
        error: (e, _) => ErrorBody(
          message: e.toString(),
          onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
        ),
        data: (snap) {
          final rows = <_ScheduleRow>[];
          for (final playlist in snap.playlists) {
            final items =
                snap.playlistItemsByPlaylistId[playlist.id] ?? const [];
            for (final item in items) {
              if (item.dailyScheduleEnabled ||
                  item.displayFrom != null ||
                  item.displayUntil != null) {
                rows.add(_ScheduleRow(playlist: playlist, item: item));
              }
            }
          }
          if (rows.isEmpty) {
            return const EmptyState(
              title: 'No scheduled items',
              subtitle:
                  'Enable daily times or date windows on playlist items from Content.',
            );
          }
          rows.sort((a, b) => a.item.title.compareTo(b.item.title));
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final row = rows[index];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(row.item.title),
                subtitle: Text(
                  [
                    row.playlist.name,
                    if (row.item.dailyScheduleEnabled) 'Daily schedule on',
                    if (row.item.displayFrom != null)
                      'From ${row.item.displayFrom!.toLocal().toString().split('.').first}',
                    if (row.item.displayUntil != null)
                      'Until ${row.item.displayUntil!.toLocal().toString().split('.').first}',
                  ].join(' · '),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ScheduleRow {
  _ScheduleRow({required this.playlist, required this.item});
  final Playlist playlist;
  final PlaylistItem item;
}

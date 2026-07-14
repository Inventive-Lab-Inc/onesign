import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';
import 'dart:io';

class ContentPage extends ConsumerWidget {
  const ContentPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(text: 'Media'),
              Tab(text: 'Playlists'),
            ],
          ),
          Expanded(
            child: console.when(
              loading: () => const LoadingBody(),
              error: (e, _) => ErrorBody(
                message: e.toString(),
                onRetry: () =>
                    ref.read(consoleControllerProvider.notifier).reload(),
              ),
              data: (snap) => TabBarView(
                children: [
                  _MediaTab(snapshot: snap),
                  _PlaylistsTab(snapshot: snap),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaTab extends ConsumerWidget {
  const _MediaTab({required this.snapshot});

  final ConsoleSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _upload(context, ref),
        icon: const Icon(Icons.upload),
        label: const Text('Upload'),
      ),
      body: snapshot.media.isEmpty
          ? EmptyState(
              title: 'No media yet',
              subtitle: 'Upload images or videos to use in playlists.',
              action: FilledButton(
                onPressed: () => _upload(context, ref),
                child: const Text('Upload'),
              ),
            )
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(consoleControllerProvider.notifier).reload(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                itemCount: snapshot.media.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = snapshot.media[index];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: _MediaThumb(item: item),
                    title: Text(item.displayName),
                    subtitle: Text(item.fileType),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        await ref
                            .read(consoleRepositoryProvider)
                            .deleteMedia(item.id);
                        await ref
                            .read(consoleControllerProvider.notifier)
                            .reload();
                      },
                    ),
                  );
                },
              ),
            ),
    );
  }
}

class _MediaThumb extends StatelessWidget {
  const _MediaThumb({required this.item});

  final MediaItem item;

  @override
  Widget build(BuildContext context) {
    final url = AppEnv.mediaObjectUrl(item.storagePath);
    if (item.fileType == 'image' && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          url,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const Icon(Icons.image),
        ),
      );
    }
    return Icon(item.fileType == 'video' ? Icons.videocam : Icons.insert_drive_file);
  }
}

Future<void> _upload(BuildContext context, WidgetRef ref) async {
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;
  final result = await FilePicker.pickFiles(
    type: FileType.custom,
    allowedExtensions: const [
      'jpg',
      'jpeg',
      'png',
      'webp',
      'gif',
      'mp4',
      'webm',
      'mov',
    ],
  );
  if (result == null || result.files.single.path == null) return;
  try {
    await ref.read(appApiClientProvider).uploadMedia(
          file: File(result.files.single.path!),
          ownerId: session.ownerId,
          workspaceId: session.activeWorkspace.id,
        );
    await ref.read(consoleControllerProvider.notifier).reload();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Uploaded')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _PlaylistsTab extends ConsumerWidget {
  const _PlaylistsTab({required this.snapshot});

  final ConsoleSnapshot snapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createPlaylist(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Playlist'),
      ),
      body: snapshot.playlists.isEmpty
          ? EmptyState(
              title: 'No playlists',
              subtitle: 'Create a playlist, then add media or websites.',
              action: FilledButton(
                onPressed: () => _createPlaylist(context, ref),
                child: const Text('Create playlist'),
              ),
            )
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(consoleControllerProvider.notifier).reload(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                itemCount: snapshot.playlists.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final playlist = snapshot.playlists[index];
                  final items =
                      snapshot.playlistItemsByPlaylistId[playlist.id] ??
                          const [];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(playlist.name),
                    subtitle: Text('${items.length} items'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/content/playlists/${playlist.id}'),
                  );
                },
              ),
            ),
    );
  }
}

Future<void> _createPlaylist(BuildContext context, WidgetRef ref) async {
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;
  final controller = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('New playlist'),
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
  final playlist = await ref.read(consoleRepositoryProvider).createPlaylist(
        ownerId: session.ownerId,
        workspaceId: session.activeWorkspace.id,
        name: controller.text.trim(),
      );
  await ref.read(consoleControllerProvider.notifier).reload();
  if (context.mounted) {
    context.push('/content/playlists/${playlist.id}');
  }
}

class PlaylistDetailPage extends ConsumerWidget {
  const PlaylistDetailPage({super.key, required this.playlistId});

  final String playlistId;

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
        final playlist = snap.playlists.cast<Playlist?>().firstWhere(
              (p) => p?.id == playlistId,
              orElse: () => null,
            );
        if (playlist == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyState(
              title: 'Playlist not found',
              subtitle: 'It may have been deleted.',
            ),
          );
        }
        final items = snap.playlistItemsByPlaylistId[playlist.id] ?? const [];
        return Scaffold(
          appBar: AppBar(
            title: Text(playlist.name),
            actions: [
              IconButton(
                tooltip: 'Delete playlist',
                onPressed: () async {
                  await ref
                      .read(consoleRepositoryProvider)
                      .deletePlaylist(playlist.id);
                  await ref.read(consoleControllerProvider.notifier).reload();
                  if (context.mounted) context.pop();
                },
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _addItem(context, ref, snap, playlist),
            icon: const Icon(Icons.add),
            label: const Text('Add item'),
          ),
          body: items.isEmpty
              ? const EmptyState(
                  title: 'Empty playlist',
                  subtitle: 'Add media or websites to play on screens.',
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item.title),
                      subtitle: Text(
                        [
                          item.websiteId != null ? 'Website' : 'Media',
                          if (item.dailyScheduleEnabled) 'Daily times',
                        ].join(' · '),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: 'Schedule',
                            icon: const Icon(Icons.schedule),
                            onPressed: () =>
                                _editItemSchedule(context, ref, item),
                          ),
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () async {
                              await ref
                                  .read(consoleRepositoryProvider)
                                  .deletePlaylistItem(item.id);
                              await ref
                                  .read(consoleControllerProvider.notifier)
                                  .reload();
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
        );
      },
    );
  }
}

Future<void> _addItem(
  BuildContext context,
  WidgetRef ref,
  ConsoleSnapshot snap,
  Playlist playlist,
) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.image),
            title: const Text('Add media'),
            onTap: () => Navigator.pop(context, 'media'),
          ),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Add website'),
            onTap: () => Navigator.pop(context, 'website'),
          ),
        ],
      ),
    ),
  );
  if (choice == null) return;
  final items = snap.playlistItemsByPlaylistId[playlist.id] ?? const [];
  final sortOrder = items.length;

  if (choice == 'media') {
    if (!context.mounted) return;
    final mediaId = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          children: [
            const ListTile(title: Text('Choose media')),
            ...snap.media.map(
              (m) => ListTile(
                title: Text(m.displayName),
                onTap: () => Navigator.pop(context, m.id),
              ),
            ),
          ],
        ),
      ),
    );
    if (mediaId == null) return;
    final media = snap.media.firstWhere((m) => m.id == mediaId);
    await ref.read(consoleRepositoryProvider).addMediaToPlaylist(
          playlistId: playlist.id,
          mediaId: mediaId,
          sortOrder: sortOrder,
          durationSeconds: media.fileType == 'image' ? 10 : null,
        );
  } else {
    if (!context.mounted) return;
    final websiteId = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          children: [
            const ListTile(title: Text('Choose website')),
            ...snap.websites.map(
              (w) => ListTile(
                title: Text(w.name),
                onTap: () => Navigator.pop(context, w.id),
              ),
            ),
          ],
        ),
      ),
    );
    if (websiteId == null) return;
    await ref.read(consoleRepositoryProvider).addWebsiteToPlaylist(
          playlistId: playlist.id,
          websiteId: websiteId,
          sortOrder: sortOrder,
        );
  }
  await ref.read(consoleControllerProvider.notifier).reload();
}

Future<void> _editItemSchedule(
  BuildContext context,
  WidgetRef ref,
  PlaylistItem item,
) async {
  var enabled = item.dailyScheduleEnabled;
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Item schedule'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Daily schedule'),
                subtitle: const Text('Play only during 00:00–23:59 each day'),
                value: enabled,
                onChanged: (v) => setState(() => enabled = v),
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
  await ref.read(consoleRepositoryProvider).updatePlaylistItemSchedule(
        itemId: item.id,
        enabled: enabled,
        schedule: enabled ? defaultWeeklySchedule() : null,
        displayFrom: item.displayFrom,
        displayUntil: item.displayUntil,
      );
  await ref.read(consoleControllerProvider.notifier).reload();
}

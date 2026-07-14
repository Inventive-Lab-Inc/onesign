import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

class WebsitesPage extends ConsumerWidget {
  const WebsitesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final console = ref.watch(consoleControllerProvider);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createWebsite(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Website'),
      ),
      body: console.when(
        loading: () => const LoadingBody(),
        error: (e, _) => ErrorBody(
          message: e.toString(),
          onRetry: () => ref.read(consoleControllerProvider.notifier).reload(),
        ),
        data: (snap) {
          if (snap.websites.isEmpty) {
            return EmptyState(
              title: 'No websites',
              subtitle: 'Add a URL to use as a playlist slide.',
              action: FilledButton(
                onPressed: () => _createWebsite(context, ref),
                child: const Text('Add website'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(consoleControllerProvider.notifier).reload(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
              itemCount: snap.websites.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final site = snap.websites[index];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(site.name),
                  subtitle: Text(site.url ?? site.sourceType),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      await ref
                          .read(consoleRepositoryProvider)
                          .deleteWebsite(site.id);
                      await ref
                          .read(consoleControllerProvider.notifier)
                          .reload();
                    },
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

Future<void> _createWebsite(BuildContext context, WidgetRef ref) async {
  final session = ref.read(sessionControllerProvider).valueOrNull;
  if (session == null) return;
  final nameController = TextEditingController();
  final urlController = TextEditingController(text: 'https://');
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('New website'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: urlController,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              labelText: 'URL',
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
          child: const Text('Create'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  try {
    await ref.read(appApiClientProvider).createWebsiteUrl(
          ownerId: session.ownerId,
          workspaceId: session.activeWorkspace.id,
          name: nameController.text.trim().isEmpty
              ? 'Website'
              : nameController.text.trim(),
          url: urlController.text.trim(),
        );
    await ref.read(consoleControllerProvider.notifier).reload();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Website created')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

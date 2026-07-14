import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/state/providers.dart';

class ConsoleShell extends ConsumerWidget {
  const ConsoleShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Home',
    ),
    NavigationDestination(
      icon: Icon(Icons.layers_outlined),
      selectedIcon: Icon(Icons.layers),
      label: 'Content',
    ),
    NavigationDestination(
      icon: Icon(Icons.tv_outlined),
      selectedIcon: Icon(Icons.tv),
      label: 'Screens',
    ),
    NavigationDestination(
      icon: Icon(Icons.devices_other_outlined),
      selectedIcon: Icon(Icons.devices_other),
      label: 'Groups',
    ),
    NavigationDestination(
      icon: Icon(Icons.language_outlined),
      selectedIcon: Icon(Icons.language),
      label: 'Web',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).valueOrNull;
    final titles = ['Dashboard', 'Content', 'Screens', 'Groups', 'Websites'];

    return Scaffold(
      appBar: AppBar(
        title: Text(titles[navigationShell.currentIndex]),
        actions: [
          if (session != null)
            PopupMenuButton<String>(
              tooltip: 'Workspace',
              onSelected: (id) {
                final ws = session.workspaces.where((w) => w.id == id);
                if (ws.isNotEmpty) {
                  ref.read(sessionControllerProvider.notifier).setWorkspace(ws.first);
                }
              },
              itemBuilder: (context) => session.workspaces
                  .map(
                    (w) => PopupMenuItem(
                      value: w.id,
                      child: Row(
                        children: [
                          if (w.id == session.activeWorkspace.id)
                            const Icon(Icons.check, size: 18)
                          else
                            const SizedBox(width: 18),
                          const SizedBox(width: 8),
                          Text(w.name),
                        ],
                      ),
                    ),
                  )
                  .toList(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Text(
                      session.activeWorkspace.name,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const Icon(Icons.arrow_drop_down),
                  ],
                ),
              ),
            ),
          IconButton(
            tooltip: 'Schedule',
            onPressed: () => context.push('/schedule'),
            icon: const Icon(Icons.calendar_month_outlined),
          ),
          IconButton(
            tooltip: 'Account',
            onPressed: () => context.push('/account'),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: navigationShell.goBranch,
        destinations: _destinations,
      ),
    );
  }
}

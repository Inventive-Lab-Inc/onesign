import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/core/workspace_name.dart';
import 'package:onesign_console/ui/onesign_logo.dart';

class ConsoleShell extends ConsumerWidget {
  const ConsoleShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _titles = [
    'Dashboard',
    'Content',
    'Screens',
    'Groups',
    'Websites',
  ];

  static const _railDestinations = [
    NavigationRailDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: Text('Home'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.layers_outlined),
      selectedIcon: Icon(Icons.layers),
      label: Text('Content'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.tv_outlined),
      selectedIcon: Icon(Icons.tv),
      label: Text('Screens'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.devices_other_outlined),
      selectedIcon: Icon(Icons.devices_other),
      label: Text('Groups'),
    ),
    NavigationRailDestination(
      icon: Icon(Icons.language_outlined),
      selectedIcon: Icon(Icons.language),
      label: Text('Web'),
    ),
  ];

  static const _barDestinations = [
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
    final useRail = Responsive.useNavigationRail(context);
    final index = navigationShell.currentIndex;
    final short = Responsive.isShortHeight(context);

    final appBar = AppBar(
      toolbarHeight: Responsive.appBarHeight(context),
      centerTitle: false,
      title: index == 0
          ? OneSignLogo(height: short ? 22 : 26)
          : Text(_titles[index]),
      actions: [
        if (session != null)
          PopupMenuButton<String>(
            tooltip: 'Workspace',
            onSelected: (id) {
              final ws = session.workspaces.where((w) => w.id == id);
              if (ws.isNotEmpty) {
                ref
                    .read(sessionControllerProvider.notifier)
                    .setWorkspace(ws.first);
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem<String>(
                enabled: false,
                height: 36,
                child: Text(
                  'Workspace',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ),
              ...session.workspaces.map(
                (w) => PopupMenuItem(
                  value: w.id,
                  child: Row(
                    children: [
                      if (w.id == session.activeWorkspace.id)
                        const Icon(Icons.check, size: 18)
                      else
                        const SizedBox(width: 18),
                      const SizedBox(width: 8),
                      Flexible(child: Text(displayWorkspaceName(w.name))),
                    ],
                  ),
                ),
              ),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: Responsive.workspaceChipMaxWidth(context),
                    ),
                    child: Text(
                      displayWorkspaceName(session.activeWorkspace.name),
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
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
    );

    final body = ResponsiveBody(child: navigationShell);

    if (useRail) {
      // Full-height rail beside content (AppBar lives in the content column).
      return Scaffold(
        body: Row(
          children: [
            ColoredBox(
              color: Brand.shellDark,
              child: SafeArea(
                right: false,
                child: NavigationRail(
                  selectedIndex: index,
                  onDestinationSelected: navigationShell.goBranch,
                  labelType: Responsive.railLabelType(context),
                  groupAlignment: short ? 0 : -1,
                  leading: Padding(
                    padding: EdgeInsets.only(bottom: short ? 4 : 12, top: 4),
                    child: Tooltip(
                      message: 'OneSign TV',
                      child: SvgPicture.asset(
                        'assets/images/onesign_mark.svg',
                        height: 22,
                        width: 22 * (211.48 / 198.04),
                        colorFilter: const ColorFilter.mode(
                          Brand.contrast,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ),
                  destinations: _railDestinations,
                ),
              ),
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(
              child: Scaffold(
                appBar: appBar,
                body: body,
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: appBar,
      body: body,
      bottomNavigationBar: NavigationBar(
        height: Responsive.navBarHeight(context),
        labelBehavior: Responsive.navLabelBehavior(context),
        selectedIndex: index,
        onDestinationSelected: navigationShell.goBranch,
        destinations: _barDestinations,
      ),
    );
  }
}

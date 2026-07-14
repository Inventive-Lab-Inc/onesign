import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/auth/auth_refresh.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/features/account/account_page.dart';
import 'package:onesign_console/features/account/billing_page.dart';
import 'package:onesign_console/features/auth/login_page.dart';
import 'package:onesign_console/features/content/content_page.dart';
import 'package:onesign_console/features/dashboard/dashboard_page.dart';
import 'package:onesign_console/features/groups/groups_page.dart';
import 'package:onesign_console/features/schedule/schedule_page.dart';
import 'package:onesign_console/features/screens/screens_page.dart';
import 'package:onesign_console/features/shell/console_shell.dart';
import 'package:onesign_console/features/websites/websites_page.dart';
import 'package:onesign_console/state/providers.dart';

final _authRefresh = AuthRefresh();

GoRouter createAppRouter() {
  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: _authRefresh,
    redirect: (context, state) {
      final session = supabase.auth.currentSession;
      final loggingIn = state.matchedLocation == '/login';
      if (session == null && !loggingIn) return '/login';
      if (session != null && loggingIn) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ConsoleShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const DashboardPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/content',
                builder: (context, state) => const ContentPage(),
                routes: [
                  GoRoute(
                    path: 'playlists/:playlistId',
                    builder: (context, state) => PlaylistDetailPage(
                      playlistId: state.pathParameters['playlistId']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/screens',
                builder: (context, state) => const ScreensPage(),
                routes: [
                  GoRoute(
                    path: ':deviceId',
                    builder: (context, state) => ScreenDetailPage(
                      deviceId: state.pathParameters['deviceId']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/groups',
                builder: (context, state) => const GroupsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/websites',
                builder: (context, state) => const WebsitesPage(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/account',
        builder: (context, state) => const AccountPage(),
      ),
      GoRoute(
        path: '/billing',
        builder: (context, state) => BillingPage(
          checkoutResult: state.uri.queryParameters['checkout'],
        ),
      ),
      GoRoute(
        path: '/schedule',
        builder: (context, state) => const SchedulePage(),
      ),
    ],
  );
}

/// Keeps session controller in sync after auth events.
class SessionBootstrap extends ConsumerWidget {
  const SessionBootstrap({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authStateProvider, (prev, next) {
      next.whenData((auth) {
        ref.invalidate(sessionControllerProvider);
        ref.invalidate(consoleControllerProvider);
      });
    });
    return child;
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/deep_links.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/router.dart';

class OneSignConsoleApp extends ConsumerStatefulWidget {
  const OneSignConsoleApp({super.key});

  @override
  ConsumerState<OneSignConsoleApp> createState() => _OneSignConsoleAppState();
}

class _OneSignConsoleAppState extends ConsumerState<OneSignConsoleApp> {
  late final GoRouter _router = createAppRouter();

  @override
  Widget build(BuildContext context) {
    return SessionBootstrap(
      child: OnesignDeepLinkBinder(
        router: _router,
        child: MaterialApp.router(
          title: 'OneSign',
          debugShowCheckedModeBanner: false,
          theme: Brand.light(),
          routerConfig: _router,
          builder: (context, child) {
            final media = MediaQuery.of(context);
            return MediaQuery(
              data: media.copyWith(
                textScaler: Responsive.clampedTextScaler(media.textScaler),
              ),
              child: child ?? const SizedBox.shrink(),
            );
          },
        ),
      ),
    );
  }
}

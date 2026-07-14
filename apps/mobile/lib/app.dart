import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
      child: MaterialApp.router(
        title: 'OneSign',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0F766E),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        routerConfig: _router,
      ),
    );
  }
}

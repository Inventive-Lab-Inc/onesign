import 'dart:io';

import 'package:flutter/foundation.dart';

/// Local SSL-inspection proxies (e.g. "Forward Trust CA") break Flutter/iOS
/// TLS to app.onesigntv.com while Mac curl/Safari still work.
///
/// Debug/profile only — never enable for App Store release builds.
void installDevHttpOverridesIfNeeded() {
  if (kReleaseMode) return;
  HttpOverrides.global = _DevHttpOverrides();
}

class _DevHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    client.badCertificateCallback = (cert, host, port) {
      // Allow MITM / corporate TLS inspection during local development only.
      return true;
    };
    return client;
  }
}

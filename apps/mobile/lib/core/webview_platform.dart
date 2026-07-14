import 'dart:io';

import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Registers the native WebView implementation when the plugin auto-registrar
/// didn't run (e.g. after hot restart with a newly added dependency).
void ensureWebViewPlatform() {
  if (WebViewPlatform.instance != null) return;
  if (Platform.isAndroid) {
    AndroidWebViewPlatform.registerWith();
  } else if (Platform.isIOS || Platform.isMacOS) {
    WebKitWebViewPlatform.registerWith();
  }
}

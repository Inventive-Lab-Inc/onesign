import 'dart:async';

import 'package:flutter/material.dart';
import 'package:onesign_console/core/deep_links.dart';
import 'package:onesign_console/core/launch_billing_url.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/webview_platform.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Full-screen in-app WebView for Stripe Checkout / Customer Portal.
///
/// Pops with [BillingSessionResult] when Stripe redirects to
/// `/mobile/billing-return` or `onesign://billing`, or `null` if closed early.
class BillingWebSheet extends StatefulWidget {
  const BillingWebSheet({super.key, required this.initialUrl});

  final Uri initialUrl;

  @override
  State<BillingWebSheet> createState() => _BillingWebSheetState();
}

class _BillingWebSheetState extends State<BillingWebSheet> {
  late final WebViewController _controller;
  var _loading = true;
  var _finished = false;
  var _title = 'Billing';

  @override
  void initState() {
    super.initState();
    ensureWebViewPlatform();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (!mounted) return;
            setState(() => _loading = progress < 100);
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() => _loading = true);
          },
          onPageFinished: (url) {
            if (!mounted) return;
            setState(() => _loading = false);
            unawaited(_refreshTitle());
            _maybeFinishFromUrl(url);
          },
          onNavigationRequest: (request) {
            final result = _resultFromUrl(request.url);
            if (result != null) {
              _finish(result);
              return NavigationDecision.prevent;
            }
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            if (uri.scheme == 'http' || uri.scheme == 'https') {
              return NavigationDecision.navigate;
            }
            if (uri.scheme == kOnesignAppScheme) {
              _finish(
                BillingSessionResult(
                  checkout: uri.queryParameters['checkout'] ?? 'success',
                  sessionId: uri.queryParameters['session_id'],
                ),
              );
              return NavigationDecision.prevent;
            }
            return NavigationDecision.prevent;
          },
          onWebResourceError: (error) {
            if (error.errorCode == 102) return;
            final result = _resultFromUrl(error.url ?? '');
            if (result != null) _finish(result);
          },
        ),
      )
      ..loadRequest(widget.initialUrl);
  }

  Future<void> _refreshTitle() async {
    try {
      final title = await _controller.getTitle();
      if (!mounted || title == null || title.trim().isEmpty) return;
      setState(() => _title = title.trim());
    } catch (_) {}
  }

  void _maybeFinishFromUrl(String url) {
    final result = _resultFromUrl(url);
    if (result != null) _finish(result);
  }

  BillingSessionResult? _resultFromUrl(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null) return null;

    if (isOnesignBillingDeepLink(uri)) {
      return BillingSessionResult(
        checkout: uri.queryParameters['checkout'] ?? 'success',
        sessionId: uri.queryParameters['session_id'],
      );
    }

    if (uri.path.contains('/mobile/billing-return')) {
      return BillingSessionResult(
        checkout: uri.queryParameters['checkout'] ?? 'success',
        sessionId: uri.queryParameters['session_id'],
      );
    }

    return null;
  }

  void _finish(BillingSessionResult result) {
    if (_finished || !mounted) return;
    _finished = true;
    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Brand.foregroundStrong,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _title,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: _loading
              ? const LinearProgressIndicator(
                  minHeight: 2,
                  color: Brand.theme,
                  backgroundColor: Brand.neutral200,
                )
              : const SizedBox(height: 2),
        ),
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}

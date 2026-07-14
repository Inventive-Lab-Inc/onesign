import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Custom scheme used by Stripe success/cancel redirects from mobile checkout.
const kOnesignAppScheme = 'onesign';

/// Stripe / portal return target: `onesign://billing?checkout=success`
Uri onesignBillingDeepLink({String? checkout, String? sessionId}) {
  return Uri(
    scheme: kOnesignAppScheme,
    host: 'billing',
    queryParameters: {
      if (checkout != null && checkout.isNotEmpty) 'checkout': checkout,
      if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
    },
  );
}

bool isOnesignBillingDeepLink(Uri uri) {
  return uri.scheme == kOnesignAppScheme &&
      (uri.host == 'billing' || uri.path == '/billing' || uri.path == 'billing');
}

String billingRouteFromDeepLink(Uri uri) {
  final checkout = uri.queryParameters['checkout'];
  if (checkout == null || checkout.isEmpty) return '/billing';
  return Uri(path: '/billing', queryParameters: {'checkout': checkout}).toString();
}

/// Listens for `onesign://` links and routes into the console.
class OnesignDeepLinkBinder extends StatefulWidget {
  const OnesignDeepLinkBinder({
    super.key,
    required this.router,
    required this.child,
  });

  final GoRouter router;
  final Widget child;

  @override
  State<OnesignDeepLinkBinder> createState() => _OnesignDeepLinkBinderState();
}

class _OnesignDeepLinkBinderState extends State<OnesignDeepLinkBinder> {
  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = _appLinks.uriLinkStream.listen(_handle);
    unawaited(_appLinks.getInitialLink().then((uri) {
      if (uri != null) _handle(uri);
    }));
  }

  void _handle(Uri uri) {
    if (!isOnesignBillingDeepLink(uri)) return;
    widget.router.go(billingRouteFromDeepLink(uri));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

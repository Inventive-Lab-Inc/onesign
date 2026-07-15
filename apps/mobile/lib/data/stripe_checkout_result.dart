/// Pure parsing of POST /api/stripe/checkout JSON (testable without Flutter).
class StripeCheckoutParseResult {
  const StripeCheckoutParseResult._({this.checkoutUrl, required this.upgraded});

  const StripeCheckoutParseResult.upgraded()
      : this._(checkoutUrl: null, upgraded: true);

  const StripeCheckoutParseResult.checkout(Uri url)
      : this._(checkoutUrl: url, upgraded: false);

  final Uri? checkoutUrl;
  final bool upgraded;
}

/// Interprets a successful (2xx) checkout API body.
///
/// In-place plan switches return `upgraded: true` (and often a Onesign return
/// URL). Only Stripe Hosted Checkout URLs should open a WebView.
StripeCheckoutParseResult parseStripeCheckoutBody(Map<String, dynamic> body) {
  final upgraded =
      body['upgraded'] == true || body['upgraded']?.toString() == 'true';
  if (upgraded) {
    return const StripeCheckoutParseResult.upgraded();
  }

  final subscriptionId = body['subscriptionId']?.toString().trim() ?? '';
  if (subscriptionId.isNotEmpty) {
    return const StripeCheckoutParseResult.upgraded();
  }

  final urlRaw = (body['url'] ?? body['redirectUrl'])?.toString().trim() ?? '';
  if (urlRaw.isEmpty) {
    // 2xx with no URL — plan was handled server-side (idempotent switch).
    return const StripeCheckoutParseResult.upgraded();
  }

  final url = Uri.tryParse(urlRaw);
  if (url == null || !url.hasScheme) {
    throw const FormatException('Invalid checkout URL from billing server');
  }

  if (_isOnesignBillingReturn(url) || !_isStripeHostedCheckout(url)) {
    return const StripeCheckoutParseResult.upgraded();
  }

  return StripeCheckoutParseResult.checkout(url);
}

bool _isOnesignBillingReturn(Uri url) {
  final path = url.path;
  return path.contains('/mobile/billing-return') ||
      (path.contains('/account') && url.queryParameters['checkout'] == 'success');
}

bool _isStripeHostedCheckout(Uri url) {
  final host = url.host.toLowerCase();
  return host == 'checkout.stripe.com' ||
      host == 'billing.stripe.com' ||
      host.endsWith('.checkout.stripe.com');
}

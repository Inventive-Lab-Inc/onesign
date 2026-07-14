import 'package:flutter/material.dart';
import 'package:onesign_console/features/account/billing_web_sheet.dart';

/// Outcome of an in-app Stripe Checkout / Portal session.
class BillingSessionResult {
  const BillingSessionResult({
    required this.checkout,
    this.sessionId,
  });

  /// `success` | `cancel` | `portal`
  final String checkout;

  /// Stripe Checkout Session id when present (`cs_…`).
  final String? sessionId;
}

/// Opens Stripe Checkout / Customer Portal in an embedded in-app WebView.
///
/// Returns [BillingSessionResult] when Stripe redirects back, or `null` if the
/// user closed the sheet early.
Future<BillingSessionResult?> openBillingSession(BuildContext context, Uri uri) {
  return Navigator.of(context).push<BillingSessionResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => BillingWebSheet(initialUrl: uri),
    ),
  );
}

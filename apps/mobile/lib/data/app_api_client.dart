import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/data/stripe_checkout_result.dart';

class AppApiClient {
  Future<String> _accessToken() async {
    final session = supabase.auth.currentSession;
    if (session == null) throw StateError('Not signed in');
    return session.accessToken;
  }

  Future<Map<String, dynamic>> signInWithGoogleIdToken(String idToken) async {
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/auth/mobile-google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Google sign-in failed');
    }
    return body;
  }

  Future<void> uploadMedia({
    required File file,
    required String ownerId,
    required String workspaceId,
  }) async {
    final token = await _accessToken();
    final filename = file.uri.pathSegments.last;
    final contentType = _mediaContentType(filename);
    final sizeBytes = await file.length();
    final authHeaders = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
    final meta = {
      'filename': filename,
      'contentType': contentType,
      'sizeBytes': sizeBytes,
      'ownerId': ownerId,
      'workspaceId': workspaceId,
    };

    final prepared = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/media/upload/prepare'),
      headers: authHeaders,
      body: jsonEncode(meta),
    );
    final preparedBody = _decode(prepared.body);
    if (prepared.statusCode < 200 || prepared.statusCode >= 300) {
      throw Exception(preparedBody['error']?.toString() ?? 'Could not start upload');
    }

    final uploadUrl = preparedBody['uploadUrl']?.toString();
    final storagePath = preparedBody['storagePath']?.toString();
    if (uploadUrl == null || storagePath == null) {
      throw Exception('Could not start upload');
    }

    final put = await http.put(
      Uri.parse(uploadUrl),
      headers: {'Content-Type': contentType},
      body: await file.readAsBytes(),
    );
    if (put.statusCode < 200 || put.statusCode >= 300) {
      throw Exception('Storage rejected the file (${put.statusCode})');
    }

    final finished = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/media/upload/finish'),
      headers: authHeaders,
      body: jsonEncode({...meta, 'storagePath': storagePath}),
    );
    final finishedBody = _decode(finished.body);
    if (finished.statusCode < 200 || finished.statusCode >= 300) {
      throw Exception(finishedBody['error']?.toString() ?? 'Upload failed');
    }
  }

  String _mediaContentType(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    return 'image/jpeg';
  }

  Future<void> createWebsiteUrl({
    required String ownerId,
    required String workspaceId,
    required String name,
    required String url,
  }) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/websites/create'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'ownerId': ownerId,
        'workspaceId': workspaceId,
        'name': name,
        'sourceType': 'url',
        'url': url,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Create website failed');
    }
  }

  Future<void> inviteAccountUser({
    required String email,
    String? firstName,
    String? lastName,
    required List<Map<String, dynamic>> roles,
  }) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/account/invite-user'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        'roles': roles,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Invite failed');
    }
  }

  Future<void> resendInvite({required String email, String? displayName}) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/account/resend-invite'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        if (displayName != null) 'displayName': displayName,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(body['error']?.toString() ?? 'Resend failed');
    }
  }

  Map<String, String> _authHeaders(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'X-Onesign-Client': 'mobile',
      };

  /// Starts Checkout (first purchase) or in-place upgrade (existing subscriber).
  Future<CheckoutStartResult> startCheckout({
    required String planTemplateId,
    required String billingPeriod,
  }) async {
    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        return await _startCheckoutOnce(
          planTemplateId: planTemplateId,
          billingPeriod: billingPeriod,
        );
      } on SocketException catch (error) {
        lastError = error;
      } on TimeoutException catch (error) {
        lastError = error;
      } on http.ClientException catch (error) {
        lastError = error;
      } on HandshakeException catch (error) {
        lastError = error;
      } on TlsException catch (error) {
        lastError = error;
      }
      await Future<void>.delayed(const Duration(milliseconds: 450));
    }
    final detail = lastError?.toString().toLowerCase() ?? '';
    if (detail.contains('handshake') ||
        detail.contains('certificate') ||
        detail.contains('tls') ||
        detail.contains('ssl') ||
        lastError is HandshakeException ||
        lastError is TlsException) {
      throw Exception(
        'Secure connection to billing failed (TLS). '
        'If you use a VPN or SSL proxy, turn it off or fully restart the debug app.',
      );
    }
    throw Exception('Couldn’t reach the billing server. Please try again.');
  }

  Future<CheckoutStartResult> _startCheckoutOnce({
    required String planTemplateId,
    required String billingPeriod,
  }) async {
    final token = await _accessToken();
    final response = await http
        .post(
          Uri.parse('${AppEnv.appUrl}/api/stripe/checkout'),
          headers: _authHeaders(token),
          body: jsonEncode({
            'planTemplateId': planTemplateId,
            'billingPeriod': billingPeriod,
          }),
        )
        .timeout(const Duration(seconds: 45));

    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _stripeApiMessage(
          body,
          response.statusCode,
          'Checkout failed (${response.statusCode})',
        ),
      );
    }

    // Truncated / non-JSON success bodies must not look like "missing URL".
    if (body.containsKey('error') &&
        body.length == 1 &&
        !body.containsKey('upgraded') &&
        !body.containsKey('url') &&
        !body.containsKey('redirectUrl') &&
        !body.containsKey('subscriptionId')) {
      throw Exception('Billing server returned an incomplete response. Please try again.');
    }

    try {
      final parsed = parseStripeCheckoutBody(body);
      if (parsed.upgraded) {
        return const CheckoutStartResult.upgraded();
      }
      final url = parsed.checkoutUrl;
      if (url == null) {
        return const CheckoutStartResult.upgraded();
      }
      return CheckoutStartResult.checkout(url);
    } on FormatException {
      throw Exception('Could not start plan change');
    }
  }

  Future<Uri> createBillingPortalUrl() async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/stripe/portal'),
      headers: _authHeaders(token),
      body: '{}',
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _stripeApiMessage(body, response.statusCode, 'Billing portal failed'),
      );
    }
    final url = body['url']?.toString();
    if (url == null || url.isEmpty) {
      throw Exception('Billing portal URL missing');
    }
    return Uri.parse(url);
  }

  Future<void> syncSubscription({String? checkoutSessionId}) async {
    final token = await _accessToken();
    final response = await http.post(
      Uri.parse('${AppEnv.appUrl}/api/stripe/sync-subscription'),
      headers: _authHeaders(token),
      body: jsonEncode({
        if (checkoutSessionId != null && checkoutSessionId.isNotEmpty)
          'checkoutSessionId': checkoutSessionId,
      }),
    );
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _stripeApiMessage(body, response.statusCode, 'Subscription sync failed'),
      );
    }
  }

  /// Loads plain-language confirm copy before checkout / plan switch.
  Future<PlanChangeConfirmCopy> previewPlanChange({
    required String planTemplateId,
    required String billingPeriod,
  }) async {
    final token = await _accessToken();
    final response = await http
        .post(
          Uri.parse('${AppEnv.appUrl}/api/stripe/preview-plan-change'),
          headers: _authHeaders(token),
          body: jsonEncode({
            'planTemplateId': planTemplateId,
            'billingPeriod': billingPeriod,
          }),
        )
        .timeout(const Duration(seconds: 30));
    final body = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _stripeApiMessage(body, response.statusCode, 'Could not preview plan change'),
      );
    }
    final copy = body['copy'];
    if (copy is Map) {
      final title = copy['title']?.toString().trim() ?? '';
      final confirmLabel = copy['confirmLabel']?.toString().trim() ?? '';
      final bulletsRaw = copy['bullets'];
      final bullets = bulletsRaw is List
          ? bulletsRaw
              .map((e) => e.toString())
              .where((e) => e.trim().isNotEmpty)
              .toList()
          : <String>[];
      if (title.isNotEmpty && bullets.isNotEmpty) {
        return PlanChangeConfirmCopy(
          title: title,
          bullets: bullets,
          confirmLabel: confirmLabel.isEmpty ? 'Continue' : confirmLabel,
        );
      }
    }
    return PlanChangeConfirmCopy.fallback(
      planName: body['targetPlanName']?.toString(),
    );
  }

  String _stripeApiMessage(
    Map<String, dynamic> body,
    int statusCode,
    String fallback,
  ) {
    final err = body['error']?.toString().trim() ?? '';
    if (err.isNotEmpty &&
        err.length <= 200 &&
        !err.toLowerCase().contains('<html') &&
        !err.startsWith('{')) {
      return err;
    }
    return switch (statusCode) {
      401 || 403 => 'Unauthorized',
      404 => 'Plan not found',
      503 => 'Stripe is not configured',
      _ => fallback,
    };
  }

  Map<String, dynamic> _decode(String raw) {
    if (raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
      return {'error': raw};
    } catch (_) {
      return {'error': raw};
    }
  }
}

/// Plain-language confirm sheet before paying or switching plans.
class PlanChangeConfirmCopy {
  const PlanChangeConfirmCopy({
    required this.title,
    required this.bullets,
    required this.confirmLabel,
  });

  factory PlanChangeConfirmCopy.fallback({String? planName}) {
    final raw = planName?.trim() ?? '';
    final name = raw.isEmpty ? 'this plan' : raw;
    return PlanChangeConfirmCopy(
      title: 'Change to $name?',
      bullets: const [
        'If this is your first payment, you’ll go to the secure payment page.',
        'If you already pay for a plan, we’ll update it on your saved card (charge or credit for days left this month).',
      ],
      confirmLabel: 'Continue',
    );
  }

  final String title;
  final List<String> bullets;
  final String confirmLabel;
}

/// Result of POST /api/stripe/checkout.
class CheckoutStartResult {
  const CheckoutStartResult._({this.checkoutUrl, required this.upgraded});

  const CheckoutStartResult.checkout(Uri url)
      : this._(checkoutUrl: url, upgraded: false);

  const CheckoutStartResult.upgraded()
      : this._(checkoutUrl: null, upgraded: true);

  /// Stripe Hosted Checkout URL for first-time subscribers.
  final Uri? checkoutUrl;

  /// True when an existing Stripe subscription was updated in place.
  final bool upgraded;
}

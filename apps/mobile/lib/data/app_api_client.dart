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
    final uri = Uri.parse('${AppEnv.appUrl}/api/media/upload');
    final req = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $token'
      ..fields['ownerId'] = ownerId
      ..fields['workspaceId'] = workspaceId
      ..files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamed = await req.send();
    final responseBody = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      final decoded = _decode(responseBody);
      throw Exception(
        decoded['error']?.toString() ??
            'Upload failed (${streamed.statusCode})',
      );
    }
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

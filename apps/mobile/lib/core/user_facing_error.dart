import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// True when the user backed out of a flow (Google sheet, dialog, etc.).
/// Callers should show nothing for these.
bool isUserCanceledAction(Object error) {
  if (error is GoogleSignInException) {
    return error.code == GoogleSignInExceptionCode.canceled;
  }
  if (error is PlatformException) {
    final code = error.code.toLowerCase();
    final message = (error.message ?? '').toLowerCase();
    return code.contains('cancel') ||
        code.contains('dismiss') ||
        code == 'user_canceled' ||
        message.contains('cancel') ||
        message.contains('dismiss');
  }
  final text = error.toString().toLowerCase();
  return text.contains('googlesigninexceptioncode.canceled') ||
      text.contains('the user canceled the sign-in flow') ||
      text.contains('sign_in_canceled') ||
      text.contains('signin_cancelled') ||
      text.contains('user canceled') ||
      text.contains('user cancelled') ||
      text.contains('operation was canceled') ||
      text.contains('operation was cancelled');
}

/// Safe copy for end users. Never returns stack traces, exception types,
/// file paths, env keys, or other implementation detail.
String userFacingError(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (error is AuthException) {
    return _authMessage(error);
  }
  if (error is GoogleSignInException) {
    return switch (error.code) {
      GoogleSignInExceptionCode.canceled => fallback, // prefer null via OrNull
      GoogleSignInExceptionCode.interrupted =>
        'Google Sign-In was interrupted. Please try again.',
      GoogleSignInExceptionCode.uiUnavailable =>
        'Google Sign-In isn’t available on this device.',
      GoogleSignInExceptionCode.clientConfigurationError ||
      GoogleSignInExceptionCode.providerConfigurationError =>
        'Google Sign-In isn’t set up for this app yet.',
      GoogleSignInExceptionCode.userMismatch =>
        'That Google account doesn’t match the signed-in user.',
      _ => 'Couldn’t sign in with Google. Please try again.',
    };
  }
  if (error is PlatformException) {
    final message = (error.message ?? '').trim();
    if (message.isNotEmpty) {
      return _fromText(message, 'Couldn’t open billing. Please try again.');
    }
    return 'Couldn’t open billing. Please try again.';
  }
  if (error is StateError) {
    return _fromText(error.message, fallback);
  }
  return _fromText(error.toString(), fallback);
}

/// Like [userFacingError], but returns null for cancel / dismiss.
String? userFacingErrorOrNull(Object error) {
  if (isUserCanceledAction(error)) return null;
  return userFacingError(error);
}

void showErrorSnackBar(BuildContext context, Object error) {
  final message = userFacingErrorOrNull(error);
  if (message == null || !context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

String _authMessage(AuthException error) {
  final status = error.statusCode;
  final msg = error.message.toLowerCase();
  if (msg.contains('invalid login credentials') ||
      msg.contains('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.contains('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (msg.contains('user already registered')) {
    return 'An account with this email already exists.';
  }
  if (msg.contains('too many requests') || status == '429') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (msg.contains('network') || msg.contains('socket') || status == '0') {
    return 'No internet connection. Check your network and try again.';
  }
  if (msg.contains('expired') || msg.contains('refresh token')) {
    return 'Your session expired. Please sign in again.';
  }
  // Never surface raw AuthException text — may include API details.
  return "Couldn't sign in. Please try again.";
}

String _fromText(String raw, String fallback) {
  // Strip Dart exception wrappers first — otherwise "Exception: …" always looks
  // technical and every API error becomes the generic fallback.
  final cleaned = raw
      .replaceFirst(RegExp(r'^Exception:\s*'), '')
      .replaceFirst(RegExp(r'^Bad state:\s*'), '')
      .replaceFirst(RegExp(r'^StateError:\s*'), '')
      .trim();
  final text = cleaned.toLowerCase();

  if (text.contains('invalid login credentials') ||
      text.contains('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (text.contains('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (text.contains('socketexception') ||
      text.contains('failed host lookup') ||
      text.contains('network is unreachable') ||
      text.contains('connection refused') ||
      text.contains('clientexception') ||
      text.contains('timed out') ||
      text.contains('timeout')) {
    return 'No internet connection. Check your network and try again.';
  }
  if (text.contains('google_server_client_id') ||
      text.contains('google_ios_client_id') ||
      text.contains('gidclientid') ||
      text.contains('no active configuration') ||
      text.contains('google sign-in is not configured') ||
      text.contains('oauth client')) {
    return 'Google Sign-In isn’t available right now.';
  }
  if (text.contains('stripe is not configured') ||
      text.contains('stripe price is not configured')) {
    return 'Billing isn’t available yet. Please try again later or contact support.';
  }
  if (text.contains('no billing account') ||
      text.contains('no stripe customer')) {
    return 'Choose a plan first to set up billing.';
  }
  if (text.contains('checkout failed') ||
      text.contains('billing portal failed') ||
      text.contains('checkout url missing') ||
      text.contains('billing portal url missing')) {
    return 'Couldn’t open billing. Please try again.';
  }
  if (text.contains('permission') ||
      text.contains('unauthorized') ||
      text.contains('not authorized') ||
      text.contains('rls') ||
      text.contains('row-level security') ||
      text.contains('forbidden') ||
      text.contains('401') ||
      text.contains('403')) {
    return 'You don’t have permission to do that.';
  }
  if (text.contains('not found') || text.contains('404')) {
    return 'We couldn’t find what you were looking for.';
  }
  if (text.contains('conflict') || text.contains('duplicate') || text.contains('23505')) {
    return 'That item already exists.';
  }
  if (text.contains('storage') || text.contains('upload')) {
    return 'Upload failed. Please try again.';
  }
  if (text.contains('pairing') || text.contains('pair code') || text.contains('invalid code')) {
    return 'That pairing code isn’t valid. Check the code and try again.';
  }
  if (text.contains('suspended')) {
    return 'This account is suspended. Contact support.';
  }
  if (text.contains('no workspaces')) {
    return 'No workspace is available for this account.';
  }
  if (text.contains('id token') || text.contains('supabase session')) {
    return 'Couldn’t finish signing in with Google. Please try again.';
  }

  // Short, plain API/State messages are OK for the snackbar.
  if (cleaned.isNotEmpty && cleaned.length <= 120 && !_looksTechnical(cleaned)) {
    return cleaned;
  }
  return fallback;
}

bool _looksTechnical(String raw) {
  final text = raw.toLowerCase();
  // Avoid matching plain words like "error" — API messages often say
  // "Error creating…" and those should stay visible to the user.
  return text.contains('stacktrace') ||
      text.contains('package:') ||
      text.contains('.dart') ||
      text.contains('.env') ||
      text.contains('plist') ||
      text.contains('nslocalized') ||
      text.contains('platformexception') ||
      text.contains('postgrest') ||
      text.startsWith('{') ||
      text.contains('nullable') ||
      text.contains('type \'') ||
      text.contains('instance of') ||
      RegExp(r'\b[a-z]+exception\b').hasMatch(text);
}

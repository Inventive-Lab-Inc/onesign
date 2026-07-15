import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/data/app_api_client.dart';

class GoogleAuthService {
  GoogleAuthService({AppApiClient? api}) : _api = api ?? AppApiClient();

  final AppApiClient _api;
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    final serverClientId = AppEnv.googleServerClientId;
    if (serverClientId.isEmpty) {
      throw StateError('Google Sign-In isn’t available right now.');
    }
    final iosClientId = AppEnv.googleIosClientId;
    if (Platform.isIOS && iosClientId.isEmpty) {
      throw StateError('Google Sign-In isn’t available right now.');
    }
    await GoogleSignIn.instance.initialize(
      serverClientId: serverClientId,
      clientId: iosClientId.isEmpty ? null : iosClientId,
    );
    _initialized = true;
  }

  Future<void> signIn() async {
    await _ensureInitialized();
    if (!GoogleSignIn.instance.supportsAuthenticate()) {
      throw StateError('Google Sign-In isn’t available on this device.');
    }
    final account = await GoogleSignIn.instance.authenticate(
      scopeHint: const ['email', 'profile'],
    );
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError(
        "Couldn't finish signing in with Google. Please try again.",
      );
    }
    final session = await _api.signInWithGoogleIdToken(idToken);
    final access = session['access_token']?.toString();
    final refresh = session['refresh_token']?.toString();
    if (access == null || refresh == null) {
      throw StateError(
        "Couldn't finish signing in with Google. Please try again.",
      );
    }
    await supabase.auth.setSession(refresh, accessToken: access);
  }
}

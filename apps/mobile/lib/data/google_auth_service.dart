import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/data/app_api_client.dart';
import 'package:google_sign_in/google_sign_in.dart';

class GoogleAuthService {
  GoogleAuthService({AppApiClient? api}) : _api = api ?? AppApiClient();

  final AppApiClient _api;
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    final serverClientId = AppEnv.googleServerClientId;
    if (serverClientId.isEmpty) {
      throw StateError(
        'GOOGLE_SERVER_CLIENT_ID is missing. Add the web Google OAuth client ID to apps/mobile/.env',
      );
    }
    final iosClientId = AppEnv.googleIosClientId;
    await GoogleSignIn.instance.initialize(
      serverClientId: serverClientId,
      clientId: iosClientId.isEmpty ? null : iosClientId,
    );
    _initialized = true;
  }

  Future<void> signIn() async {
    await _ensureInitialized();
    if (!GoogleSignIn.instance.supportsAuthenticate()) {
      throw StateError('Google Sign-In is not supported on this platform.');
    }
    final account = await GoogleSignIn.instance.authenticate(
      scopeHint: const ['email', 'profile'],
    );
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw StateError(
        'Google did not return an ID token. Check OAuth client setup (SHA-1 / iOS client).',
      );
    }
    final session = await _api.signInWithGoogleIdToken(idToken);
    final access = session['access_token']?.toString();
    final refresh = session['refresh_token']?.toString();
    if (access == null || refresh == null) {
      throw StateError('Server did not return a Supabase session.');
    }
    await supabase.auth.setSession(refresh, accessToken: access);
  }
}

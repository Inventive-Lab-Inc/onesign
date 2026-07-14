import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppEnv {
  static String get supabaseUrl => dotenv.env['SUPABASE_URL']?.trim() ?? '';
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY']?.trim() ?? '';
  static String get appUrl =>
      (dotenv.env['APP_URL']?.trim().isNotEmpty ?? false)
          ? dotenv.env['APP_URL']!.trim().replaceAll(RegExp(r'/$'), '')
          : 'https://app.onesigntv.com';
  static String get mediaBaseUrl =>
      (dotenv.env['MEDIA_BASE_URL']?.trim().isNotEmpty ?? false)
          ? dotenv.env['MEDIA_BASE_URL']!.trim().replaceAll(RegExp(r'/$'), '')
          : 'https://storage.onesigntv.com/onesign-media';

  /// Web Auth.js Google client ID — used as [GoogleSignIn] serverClientId.
  static String get googleServerClientId =>
      dotenv.env['GOOGLE_SERVER_CLIENT_ID']?.trim() ?? '';

  /// Optional iOS OAuth client ID from Google Cloud Console.
  static String get googleIosClientId =>
      dotenv.env['GOOGLE_IOS_CLIENT_ID']?.trim() ?? '';

  static String mediaObjectUrl(String? storagePath) {
    if (storagePath == null || storagePath.isEmpty) return '';
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }
    return '$mediaBaseUrl/${storagePath.replaceFirst(RegExp(r'^/'), '')}';
  }
}

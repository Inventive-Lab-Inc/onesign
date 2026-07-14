import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> bootstrapSupabase() async {
  final url = dotenv.env['SUPABASE_URL']?.trim() ?? '';
  final anonKey = dotenv.env['SUPABASE_ANON_KEY']?.trim() ?? '';

  if (url.isEmpty || anonKey.isEmpty) {
    throw StateError(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY. '
      'Copy apps/mobile/.env.example to .env and fill values '
      '(or run scripts/bootstrap-mobile.sh).',
    );
  }

  await Supabase.initialize(url: url, publishableKey: anonKey);
}

SupabaseClient get supabase => Supabase.instance.client;

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:onesign_console/app.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  await bootstrapSupabase();
  runApp(const ProviderScope(child: OneSignConsoleApp()));
}

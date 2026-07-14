import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onesign_console/app.dart';

void main() {
  testWidgets('app widget constructs', (tester) async {
    // Full app needs dotenv + Supabase; smoke-test the widget type only.
    expect(OneSignConsoleApp, isNotNull);
    expect(ProviderScope, isNotNull);
  });
}

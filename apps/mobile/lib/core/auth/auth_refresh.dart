import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Notifies [GoRouter] when the Supabase session changes.
class AuthRefresh extends ChangeNotifier {
  AuthRefresh() {
    _subscription = supabase.auth.onAuthStateChange.listen((_) {
      notifyListeners();
    });
  }

  late final StreamSubscription<AuthState> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

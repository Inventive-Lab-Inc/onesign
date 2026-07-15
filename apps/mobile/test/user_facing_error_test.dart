import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:onesign_console/core/user_facing_error.dart';

void main() {
  test('canceled Google sign-in shows nothing', () {
    final error = GoogleSignInException(
      code: GoogleSignInExceptionCode.canceled,
      description: 'The user canceled the sign-in flow.',
    );
    expect(isUserCanceledAction(error), isTrue);
    expect(userFacingErrorOrNull(error), isNull);
  });

  test('invalid credentials map to a clear message', () {
    expect(
      userFacingError(Exception('Invalid login credentials')),
      'Incorrect email or password.',
    );
  });

  test('raw platform exceptions stay hidden', () {
    final message = userFacingError(
      Exception(
        'PlatformException(google_sign_in, No active configuration. '
        'Make sure GIDClientID is set in Info.plist., NSInvalidArgumentException, null)',
      ),
    );
    expect(message.contains('GIDClientID'), isFalse);
    expect(message.contains('Info.plist'), isFalse);
    expect(message.contains('PlatformException'), isFalse);
  });

  test('plain Exception API messages are shown after stripping the prefix', () {
    expect(
      userFacingError(Exception('Stripe is not configured')),
      'Billing isn’t available yet. Please try again later or contact support.',
    );
    expect(
      userFacingError(Exception('Unauthorized')),
      'You don’t have permission to do that.',
    );
    expect(
      userFacingError(Exception('No billing account yet')),
      'Choose a plan first to set up billing.',
    );
  });

  test('messages containing error: are not treated as technical', () {
    expect(
      userFacingError(Exception('Error creating checkout session')),
      'Error creating checkout session',
    );
  });

  test('billing fallback is used instead of Something went wrong', () {
    final message = userFacingError(
      Exception('HttpException: Connection closed before full header was received'),
      fallback: 'Couldn’t change your plan. Please try again.',
    );
    expect(message, 'Couldn’t change your plan. Please try again.');
    expect(message.contains('Something went wrong'), isFalse);
  });
}

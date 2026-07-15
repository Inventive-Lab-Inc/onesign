import 'package:flutter_test/flutter_test.dart';
import 'package:onesign_console/data/stripe_checkout_result.dart';

void main() {
  test('upgraded flag means in-place success without WebView URL', () {
    final result = parseStripeCheckoutBody({
      'upgraded': true,
      'url': 'https://app.onesigntv.com/mobile/billing-return?checkout=success',
      'subscriptionId': 'sub_123',
    });
    expect(result.upgraded, isTrue);
    expect(result.checkoutUrl, isNull);
  });

  test('onesign return URL without upgraded is still treated as success', () {
    final result = parseStripeCheckoutBody({
      'url': 'https://app.onesigntv.com/mobile/billing-return?checkout=success',
    });
    expect(result.upgraded, isTrue);
  });

  test('subscriptionId alone means success', () {
    final result = parseStripeCheckoutBody({
      'subscriptionId': 'sub_abc',
      'status': 'active',
    });
    expect(result.upgraded, isTrue);
  });

  test('empty 2xx body means success', () {
    final result = parseStripeCheckoutBody({});
    expect(result.upgraded, isTrue);
  });

  test('Stripe Hosted Checkout URL opens WebView path', () {
    final result = parseStripeCheckoutBody({
      'url': 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    expect(result.upgraded, isFalse);
    expect(result.checkoutUrl?.host, 'checkout.stripe.com');
  });
}

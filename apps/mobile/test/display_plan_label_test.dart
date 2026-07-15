import 'package:flutter_test/flutter_test.dart';
import 'package:onesign_console/core/display_plan_label.dart';
import 'package:onesign_console/core/models/console_models.dart';

PlanTemplateInfo _plan({
  required String id,
  required String name,
  required int devices,
}) {
  return PlanTemplateInfo(
    id: id,
    name: name,
    tagline: '',
    deviceLimit: devices,
    storageLimitBytes: 0,
    monthlyPriceCents: 900,
    annualMonthlyPriceCents: 700,
    ctaLabel: 'Choose',
    features: const [],
    isHighlighted: false,
  );
}

AccountProfile _profile({
  String? templateId,
  String? planKind,
  int deviceLimit = 1,
  bool trial = false,
}) {
  return AccountProfile(
    id: 'u1',
    deviceLimit: deviceLimit,
    storageLimitBytes: 0,
    storageUsedBytes: 0,
    planKind: planKind,
    planTemplateId: templateId,
    trialEndsAt: trial ? DateTime.now().add(const Duration(days: 3)) : null,
  );
}

void main() {
  final plans = [
    _plan(id: 'solo', name: 'Solo', devices: 1),
    _plan(id: 'growth', name: 'Growth', devices: 5),
    _plan(id: 'network', name: 'Network', devices: 15),
  ];

  test('shows catalog plan name instead of standard', () {
    expect(
      displayAccountPlanLabel(
        profile: _profile(templateId: 'growth', planKind: 'standard', deviceLimit: 5),
        plans: plans,
      ),
      'Growth',
    );
  });

  test('shows trial with plan name', () {
    expect(
      displayAccountPlanLabel(
        profile: _profile(templateId: 'solo', planKind: 'trial', trial: true),
        plans: plans,
      ),
      'Solo trial',
    );
  });

  test('never shows Standard when catalog is missing', () {
    expect(
      displayAccountPlanLabel(
        profile: _profile(planKind: 'standard', deviceLimit: 99),
        plans: const [],
      ),
      '—',
    );
  });
}

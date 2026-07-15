import 'package:onesign_console/core/models/console_models.dart';

/// User-facing plan label (Solo / Growth / Network), never raw `plan_kind`.
String displayAccountPlanLabel({
  required AccountProfile? profile,
  required List<PlanTemplateInfo> plans,
}) {
  if (profile == null) return '—';

  final matched = matchPlanTemplate(plans, profile);

  if (profile.isOnTrial) {
    final name = matched?.name ?? 'Solo';
    return '$name trial';
  }

  if (profile.planKind == 'custom') {
    return matched != null ? '${matched.name} (custom)' : 'Custom';
  }

  if (profile.planKind == 'free') {
    return 'Free';
  }

  if (matched != null) {
    return matched.name;
  }

  // Last resort: humanize plan_kind (standard → Standard), never show raw enum.
  return _titleCase(profile.planKind ?? 'Active');
}

PlanTemplateInfo? matchPlanTemplate(
  List<PlanTemplateInfo> plans,
  AccountProfile profile,
) {
  if (plans.isEmpty) return null;
  final templateId = profile.planTemplateId;
  if (templateId != null) {
    for (final plan in plans) {
      if (plan.id == templateId) return plan;
    }
  }
  final sorted = [...plans]..sort((a, b) => a.deviceLimit.compareTo(b.deviceLimit));
  for (final plan in sorted.reversed) {
    if (plan.deviceLimit <= profile.deviceLimit) return plan;
  }
  return sorted.isEmpty ? null : sorted.first;
}

String _titleCase(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return 'Active';
  return text
      .split(RegExp(r'[\s_]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
}

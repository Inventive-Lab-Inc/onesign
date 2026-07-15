import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/launch_billing_url.dart';
import 'package:onesign_console/core/models/console_models.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/core/user_facing_error.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';
import 'package:url_launcher/url_launcher.dart';

class BillingPage extends ConsumerStatefulWidget {
  const BillingPage({super.key, this.checkoutResult});

  /// From deep link / query: success | cancel | portal
  final String? checkoutResult;

  @override
  ConsumerState<BillingPage> createState() => _BillingPageState();
}

class _BillingPageState extends ConsumerState<BillingPage>
    with WidgetsBindingObserver {
  var _billingPeriod = 'monthly';
  var _busyPlanId = '';
  var _portalBusy = false;
  var _syncing = false;
  var _handledCheckoutToast = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncAfterReturn());
  }

  @override
  void didUpdateWidget(covariant BillingPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.checkoutResult != widget.checkoutResult) {
      _handledCheckoutToast = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncAfterReturn());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncAfterReturn();
    }
  }

  Future<void> _syncAfterReturn({
    String? checkoutSessionId,
    bool showSuccessToast = false,
  }) async {
    if (_syncing) return;
    _syncing = true;
    try {
      try {
        await ref.read(sessionControllerProvider.notifier).refresh();
      } catch (_) {
        // Never fail the plan-change UX on a soft profile refresh.
      }
      final session = ref.read(sessionControllerProvider).valueOrNull;
      final canManage = session != null && _canManageBilling(session);
      final shouldSync = canManage &&
          (checkoutSessionId != null ||
              showSuccessToast ||
              widget.checkoutResult == 'success' ||
              widget.checkoutResult == 'portal' ||
              session.profile?.hasStripeCustomer == true);

      if (shouldSync) {
        try {
          await ref.read(appApiClientProvider).syncSubscription(
                checkoutSessionId: checkoutSessionId,
              );
          await ref.read(sessionControllerProvider.notifier).refresh();
        } catch (_) {
          // Webhook / delayed Stripe state; profile refresh below is enough.
        }
      }
      ref.invalidate(activePlansProvider);
      if (showSuccessToast && mounted) {
        _handledCheckoutToast = true;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Subscription updated. Your plan limits are refreshed.'),
          ),
        );
      } else {
        _showCheckoutToastIfNeeded();
      }
    } finally {
      _syncing = false;
    }
  }

  void _showCheckoutToastIfNeeded() {
    if (_handledCheckoutToast || !mounted) return;
    final result = widget.checkoutResult;
    if (result == null || result.isEmpty) return;
    _handledCheckoutToast = true;
    final message = switch (result) {
      'success' => 'Subscription updated. Your plan limits are refreshed.',
      'cancel' => 'Checkout canceled. No charge was made.',
      'portal' => 'Billing details updated.',
      _ => null,
    };
    if (message == null) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  bool _canManageBilling(SessionState session) {
    return session.activeWorkspace.hasPermission('administrator') ||
        session.activeWorkspace.role == 'owner' ||
        session.activeWorkspace.role == 'account_admin' ||
        session.activeWorkspace.role == 'admin';
  }

  PlanTemplateInfo? _matchPlan(
    List<PlanTemplateInfo> plans,
    AccountProfile? profile,
  ) {
    if (profile == null || plans.isEmpty) return null;
    if (profile.planTemplateId != null) {
      for (final plan in plans) {
        if (plan.id == profile.planTemplateId) return plan;
      }
    }
    final sorted = [...plans]..sort((a, b) => a.deviceLimit.compareTo(b.deviceLimit));
    for (final plan in sorted.reversed) {
      if (plan.deviceLimit <= profile.deviceLimit) return plan;
    }
    return sorted.first;
  }

  String _planStatusLabel(AccountProfile? profile, PlanTemplateInfo? matched) {
    if (profile?.planKind == 'custom') return 'Custom';
    if (profile?.isOnTrial == true) return 'Trial';
    if (profile?.subscriptionStatus == 'past_due') return 'Past due';
    if (matched != null) return 'Active';
    return profile?.planKind ?? 'Active';
  }

  String _actionLabel({
    required PlanTemplateInfo target,
    required PlanTemplateInfo? current,
    required AccountProfile? profile,
  }) {
    final onTrial = profile?.isOnTrial == true;
    // Same catalog tier on trial is not a paid plan — still let them subscribe.
    if (onTrial && current?.id == target.id) {
      return 'Subscribe to ${target.name}';
    }
    if (!onTrial && current?.id == target.id) return 'Current plan';
    if (current == null) return 'Choose ${target.name}';
    if (target.deviceLimit > current.deviceLimit) {
      return 'Upgrade to ${target.name}';
    }
    if (target.deviceLimit < current.deviceLimit) {
      return 'Switch to ${target.name}';
    }
    return 'Choose ${target.name}';
  }

  bool _isPaidCurrentPlan({
    required PlanTemplateInfo target,
    required PlanTemplateInfo? current,
    required AccountProfile? profile,
  }) {
    if (profile?.isOnTrial == true) return false;
    return current?.id == target.id;
  }

  Future<void> _openCheckout(PlanTemplateInfo plan) async {
    setState(() => _busyPlanId = plan.id);
    try {
      final start = await ref.read(appApiClientProvider).startCheckout(
            planTemplateId: plan.id,
            billingPeriod: _billingPeriod,
          );
      if (!mounted) return;

      // Existing subscriber: plan already changed server-side (prorated).
      if (start.upgraded || _isImmediateBillingReturn(start.checkoutUrl)) {
        await _syncAfterReturn(showSuccessToast: true);
        return;
      }

      final checkoutUrl = start.checkoutUrl;
      if (checkoutUrl == null) {
        throw Exception('Could not start plan change');
      }

      final result = await openBillingSession(context, checkoutUrl);
      if (!mounted) return;
      if (result == null) {
        await _syncAfterReturn();
        return;
      }
      _handledCheckoutToast = false;
      await _syncAfterReturn(
        checkoutSessionId: result.sessionId,
        showSuccessToast: result.checkout == 'success',
      );
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyPlanId = '');
    }
  }

  bool _isImmediateBillingReturn(Uri? url) {
    if (url == null) return false;
    return url.path.contains('/mobile/billing-return') ||
        (url.path.contains('/account') &&
            url.queryParameters['checkout'] == 'success');
  }

  Future<void> _openPortal() async {
    setState(() => _portalBusy = true);
    try {
      final uri = await ref.read(appApiClientProvider).createBillingPortalUrl();
      if (!mounted) return;
      final result = await openBillingSession(context, uri);
      if (!mounted) return;
      if (result == null) {
        await _syncAfterReturn();
        return;
      }
      _handledCheckoutToast = false;
      await _syncAfterReturn();
      if (!mounted) return;
      GoRouter.of(context).go('/billing?checkout=${result.checkout}');
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _portalBusy = false);
    }
  }

  Future<void> _refresh() async {
    await _syncAfterReturn();
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(sessionControllerProvider);
    final plansAsync = ref.watch(activePlansProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: Responsive.appBarHeight(context),
        title: const Text('Billing & plan'),
      ),
      body: sessionAsync.when(
        loading: () => const LoadingBody(),
        error: (e, _) => ErrorBody(
          error: e,
          onRetry: () => ref.read(sessionControllerProvider.notifier).refresh(),
        ),
        data: (session) {
          if (session == null) {
            return const EmptyState(
              title: 'Not signed in',
              subtitle: 'Sign in to manage billing.',
            );
          }
          final profile = session.profile;
          final canManage = _canManageBilling(session);

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ResponsiveBody(
              child: ListView(
                padding: Responsive.pagePadding(context),
                children: [
                  plansAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => EmptyState(
                      title: 'Could not load plans',
                      subtitle: userFacingError(e),
                      action: FilledButton(
                        onPressed: () => ref.invalidate(activePlansProvider),
                        child: const Text('Retry'),
                      ),
                    ),
                    data: (plans) {
                      final matched = _matchPlan(plans, profile);
                      final status = _planStatusLabel(profile, matched);
                      final title = profile?.planKind == 'custom'
                          ? 'Custom'
                          : profile?.isOnTrial == true
                              ? '${matched?.name ?? 'Solo'} trial'
                              : matched?.name ?? 'Standard';

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Card(
                            margin: EdgeInsets.zero,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          title,
                                          style: theme.textTheme.titleLarge,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Brand.soft,
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          status,
                                          style: theme.textTheme.labelMedium
                                              ?.copyWith(
                                            color: Brand.foregroundStrong,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (matched?.tagline.isNotEmpty == true) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      matched!.tagline,
                                      style:
                                          theme.textTheme.bodyMedium?.copyWith(
                                        color: theme
                                            .colorScheme.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                  if (profile?.isOnTrial == true &&
                                      profile?.trialEndsAt != null) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'Trial ends ${_formatDate(profile!.trialEndsAt!)}',
                                      style: theme.textTheme.bodySmall,
                                    ),
                                  ],
                                  if (canManage &&
                                      profile?.hasStripeCustomer == true &&
                                      profile?.isOnTrial != true) ...[
                                    const SizedBox(height: 12),
                                    OutlinedButton.icon(
                                      onPressed:
                                          _portalBusy ? null : _openPortal,
                                      icon: _portalBusy
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child:
                                                  CircularProgressIndicator(
                                                strokeWidth: 2,
                                              ),
                                            )
                                          : const Icon(Icons.credit_card, size: 18),
                                      label: Text(
                                        _portalBusy
                                            ? 'Opening…'
                                            : 'Manage billing',
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text('Usage', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 8),
                          _UsageMeter(
                            label: 'Screens',
                            valueLabel:
                                '${session.accountDeviceCount} / ${profile?.deviceLimit ?? '—'}',
                            ratio: _ratio(
                              session.accountDeviceCount,
                              profile?.deviceLimit ?? 0,
                            ),
                          ),
                          const SizedBox(height: 10),
                          _UsageMeter(
                            label: 'Storage',
                            valueLabel:
                                '${_formatBytes(profile?.storageUsedBytes ?? 0)} / ${_formatBytes(profile?.storageLimitBytes ?? 0)}',
                            ratio: _ratio(
                              profile?.storageUsedBytes ?? 0,
                              profile?.storageLimitBytes ?? 0,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Text('Plans', style: theme.textTheme.titleMedium),
                              const Spacer(),
                              SegmentedButton<String>(
                                segments: const [
                                  ButtonSegment(
                                    value: 'monthly',
                                    label: Text('Monthly'),
                                  ),
                                  ButtonSegment(
                                    value: 'annual',
                                    label: Text('Annual'),
                                  ),
                                ],
                                selected: {_billingPeriod},
                                onSelectionChanged: (value) {
                                  setState(
                                    () => _billingPeriod = value.first,
                                  );
                                },
                              ),
                            ],
                          ),
                          if (!canManage) ...[
                            const SizedBox(height: 8),
                            Text(
                              'Ask an account admin to change the plan.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          ...plans.map((plan) {
                            final action = _actionLabel(
                              target: plan,
                              current: matched,
                              profile: profile,
                            );
                            final isPaidCurrent = _isPaidCurrentPlan(
                              target: plan,
                              current: matched,
                              profile: profile,
                            );
                            final busy = _busyPlanId == plan.id;
                            final priceCents = _billingPeriod == 'annual' &&
                                    plan.annualMonthlyPriceCents > 0
                                ? plan.annualMonthlyPriceCents
                                : plan.monthlyPriceCents;

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Card(
                                margin: EdgeInsets.zero,
                                color: plan.isHighlighted
                                    ? Brand.softer
                                    : null,
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              plan.name,
                                              style:
                                                  theme.textTheme.titleMedium,
                                            ),
                                          ),
                                          if (plan.badge != null &&
                                              plan.badge!.trim().isNotEmpty)
                                            Text(
                                              plan.badge!,
                                              style: theme
                                                  .textTheme.labelSmall
                                                  ?.copyWith(
                                                color: Brand.theme,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '\$${(priceCents / 100).toStringAsFixed(priceCents % 100 == 0 ? 0 : 2)}/mo'
                                        '${_billingPeriod == 'annual' ? ' billed annually' : ''}',
                                        style: theme.textTheme.titleSmall
                                            ?.copyWith(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(
                                        '${plan.deviceLimit} screen${plan.deviceLimit == 1 ? '' : 's'} · ${_formatBytes(plan.storageLimitBytes)} storage',
                                        style: theme.textTheme.bodySmall
                                            ?.copyWith(
                                          color: theme
                                              .colorScheme.onSurfaceVariant,
                                        ),
                                      ),
                                      if (plan.marketingFeatures
                                          .isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        ...plan.marketingFeatures
                                            .take(4)
                                            .map(
                                              (f) => Padding(
                                                padding:
                                                    const EdgeInsets.only(
                                                  bottom: 2,
                                                ),
                                                child: Row(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment
                                                          .start,
                                                  children: [
                                                    const Icon(
                                                      Icons.check,
                                                      size: 16,
                                                      color: Brand.theme,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Expanded(
                                                      child: Text(
                                                        f,
                                                        style: theme
                                                            .textTheme
                                                            .bodySmall,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                      ],
                                      const SizedBox(height: 12),
                                      SizedBox(
                                        width: double.infinity,
                                        child: FilledButton(
                                          onPressed: !canManage ||
                                                  isPaidCurrent ||
                                                  busy ||
                                                  !plan.isBillable
                                              ? null
                                              : () => _openCheckout(plan),
                                          child: busy
                                              ? const SizedBox(
                                                  width: 18,
                                                  height: 18,
                                                  child:
                                                      CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    color: Colors.white,
                                                  ),
                                                )
                                              : Text(action),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                          const SizedBox(height: 8),
                          Text(
                            'Need 20+ screens? Contact sales.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          TextButton(
                            onPressed: () => launchUrl(
                              Uri.parse(
                                'mailto:aminulislamborhan@gmail.com?subject=${Uri.encodeComponent('OneSign Custom plan')}',
                              ),
                            ),
                            child: const Text('Contact sales'),
                          ),
                          const SizedBox(height: 24),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _UsageMeter extends StatelessWidget {
  const _UsageMeter({
    required this.label,
    required this.valueLabel,
    required this.ratio,
  });

  final String label;
  final String valueLabel;
  final double ratio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final clamped = ratio.clamp(0.0, 1.0);
    final color = clamped >= 1
        ? Colors.red.shade600
        : clamped >= 0.85
            ? Colors.amber.shade700
            : Brand.theme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: theme.textTheme.labelLarge),
            const Spacer(),
            Text(valueLabel, style: theme.textTheme.labelLarge),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: clamped.isFinite ? clamped : 0,
            minHeight: 8,
            backgroundColor: Brand.neutral200,
            color: color,
          ),
        ),
      ],
    );
  }
}

double _ratio(num used, num limit) {
  if (limit <= 0) return 0;
  return used / limit;
}

String _formatBytes(int bytes) {
  if (bytes <= 0) return '0 MB';
  const mb = 1024 * 1024;
  const gb = 1024 * mb;
  if (bytes >= gb) {
    final value = bytes / gb;
    return '${value.toStringAsFixed(value >= 10 ? 0 : 1)} GB';
  }
  final value = bytes / mb;
  return '${value.toStringAsFixed(value >= 10 ? 0 : 1)} MB';
}

String _formatDate(DateTime date) {
  final local = date.toLocal();
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
}

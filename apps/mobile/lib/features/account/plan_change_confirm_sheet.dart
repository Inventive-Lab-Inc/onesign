import 'package:flutter/material.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/data/app_api_client.dart';

/// Bottom sheet: explain pay vs switch before calling Stripe.
Future<bool> showPlanChangeConfirmSheet({
  required BuildContext context,
  required Future<PlanChangeConfirmCopy> Function() loadCopy,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      return _PlanChangeConfirmSheet(loadCopy: loadCopy);
    },
  );
  return result == true;
}

class _PlanChangeConfirmSheet extends StatefulWidget {
  const _PlanChangeConfirmSheet({required this.loadCopy});

  final Future<PlanChangeConfirmCopy> Function() loadCopy;

  @override
  State<_PlanChangeConfirmSheet> createState() => _PlanChangeConfirmSheetState();
}

class _PlanChangeConfirmSheetState extends State<_PlanChangeConfirmSheet> {
  late Future<PlanChangeConfirmCopy> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loadCopy();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.paddingOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, 16 + bottom),
        child: FutureBuilder<PlanChangeConfirmCopy>(
          future: _future,
          builder: (context, snapshot) {
            final loading = snapshot.connectionState != ConnectionState.done;
            final copy = snapshot.data ?? PlanChangeConfirmCopy.fallback();
            final errored = snapshot.hasError;

            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  loading
                      ? 'Checking what you’ll pay…'
                      : (errored
                          ? PlanChangeConfirmCopy.fallback().title
                          : copy.title),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  for (final line in (errored
                      ? PlanChangeConfirmCopy.fallback().bullets
                      : copy.bullets))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Icon(Icons.circle, size: 6, color: Brand.theme),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              line,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                height: 1.35,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    child: Text(
                      errored
                          ? PlanChangeConfirmCopy.fallback().confirmLabel
                          : copy.confirmLabel,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Cancel'),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

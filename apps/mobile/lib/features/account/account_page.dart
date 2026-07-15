import 'package:flutter/material.dart';
import 'package:onesign_console/core/display_plan_label.dart';
import 'package:onesign_console/core/user_facing_error.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/core/workspace_name.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/common_widgets.dart';

class AccountPage extends ConsumerWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionAsync = ref.watch(sessionControllerProvider);
    final usersAsync = ref.watch(accountUsersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
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
              subtitle: 'Sign in to manage your account.',
            );
          }
          final profile = session.profile;
          final canAdmin =
              session.activeWorkspace.hasPermission('administrator') ||
                  session.activeWorkspace.role == 'owner' ||
                  session.activeWorkspace.role == 'account_admin' ||
                  session.activeWorkspace.role == 'admin';

          return ResponsiveBody(
            child: ListView(
              padding: Responsive.pagePadding(context),
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Client'),
                  subtitle: Text(profile?.clientName ?? '—'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Plan'),
                  subtitle: ref.watch(activePlansProvider).when(
                        loading: () => Text(
                          profile?.isOnTrial == true ? '…' : '…',
                        ),
                        error: (_, __) => Text(
                          displayAccountPlanLabel(
                            profile: profile,
                            plans: const [],
                          ),
                        ),
                        data: (plans) => Text(
                          displayAccountPlanLabel(
                            profile: profile,
                            plans: plans,
                          ),
                        ),
                      ),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Screens'),
                  subtitle: Text(
                    '${session.accountDeviceCount} / ${profile?.deviceLimit ?? '—'}',
                  ),
                ),
                const Divider(),
                Text('Workspace',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...session.workspaces.map(
                  (ws) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      ws.id == session.activeWorkspace.id
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                    ),
                    title: Text(displayWorkspaceName(ws.name)),
                    subtitle: Text(ws.role),
                    onTap: () => ref
                        .read(sessionControllerProvider.notifier)
                        .setWorkspace(ws),
                  ),
                ),
                const Divider(),
                Row(
                  children: [
                    Text('Team',
                        style: Theme.of(context).textTheme.titleMedium),
                    const Spacer(),
                    if (canAdmin)
                      TextButton(
                        onPressed: () => _invite(context, ref, session),
                        child: const Text('Invite'),
                      ),
                  ],
                ),
                usersAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(userFacingError(e)),
                  ),
                  data: (users) {
                    if (users.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text('No teammates listed.'),
                      );
                    }
                    return Column(
                      children: users.map((user) {
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                              user.displayName?.trim().isNotEmpty == true
                                  ? user.displayName!
                                  : user.email),
                          subtitle: Text(
                            [
                              user.email,
                              if (user.isOwner) 'Owner',
                              if (user.invitationPending) 'Invite pending',
                            ].join(' · '),
                          ),
                          trailing: user.invitationPending && canAdmin
                              ? IconButton(
                                  tooltip: 'Resend invite',
                                  onPressed: () async {
                                    try {
                                      await ref
                                          .read(appApiClientProvider)
                                          .resendInvite(
                                            email: user.email,
                                            displayName: user.displayName,
                                          );
                                      ref.invalidate(accountUsersProvider);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text('Invite resent'),
                                          ),
                                        );
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          SnackBar(
                                              content:
                                                  Text(userFacingError(e))),
                                        );
                                      }
                                    }
                                  },
                                  icon: const Icon(Icons.outgoing_mail),
                                )
                              : null,
                        );
                      }).toList(),
                    );
                  },
                ),
                const Divider(),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.credit_card_outlined),
                  title: const Text('Billing & plan'),
                  subtitle: const Text('Usage, upgrades, and payment'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/billing'),
                ),
                const SizedBox(height: 12),
                FilledButton.tonal(
                  onPressed: () =>
                      ref.read(sessionControllerProvider.notifier).signOut(),
                  child: const Text('Sign out'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

Future<void> _invite(
  BuildContext context,
  WidgetRef ref,
  SessionState session,
) async {
  final emailController = TextEditingController();
  final firstController = TextEditingController();
  final lastController = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Invite teammate'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: firstController,
            decoration: const InputDecoration(
              labelText: 'First name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: lastController,
            decoration: const InputDecoration(
              labelText: 'Last name',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Send invite'),
        ),
      ],
    ),
  );
  if (ok != true) return;
  try {
    await ref.read(appApiClientProvider).inviteAccountUser(
      email: emailController.text.trim(),
      firstName: firstController.text.trim().isEmpty
          ? null
          : firstController.text.trim(),
      lastName: lastController.text.trim().isEmpty
          ? null
          : lastController.text.trim(),
      roles: [
        {
          'workspace_id': session.activeWorkspace.id,
          'role': 'standard',
          'permissions': <String>[],
        },
      ],
    );
    ref.invalidate(accountUsersProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invite sent')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      showErrorSnackBar(context, e);
    }
  }
}

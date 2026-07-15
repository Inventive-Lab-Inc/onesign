import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:onesign_console/core/config/app_env.dart';
import 'package:onesign_console/core/supabase/supabase_bootstrap.dart';
import 'package:onesign_console/core/theme/brand.dart';
import 'package:onesign_console/core/theme/responsive.dart';
import 'package:onesign_console/core/user_facing_error.dart';
import 'package:onesign_console/state/providers.dart';
import 'package:onesign_console/ui/onesign_logo.dart';
import 'package:url_launcher/url_launcher.dart';

enum _LoginStep { email, password }

/// Pixel-aligned to app.onesigntv.com/login mobile view.
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();

  _LoginStep _step = _LoginStep.email;
  bool _loading = false;
  bool _showPassword = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _resetToEmail() {
    setState(() {
      _step = _LoginStep.email;
      _password.clear();
      _showPassword = false;
      _error = null;
    });
  }

  Future<void> _continueEmail() async {
    final trimmed = _email.text.trim();
    if (trimmed.isEmpty) return;
    setState(() {
      _error = null;
      _email.text = trimmed;
      _step = _LoginStep.password;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _passwordFocus.requestFocus();
    });
  }

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await supabase.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
      ref.invalidate(sessionControllerProvider);
      ref.invalidate(consoleControllerProvider);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = userFacingErrorOrNull(error) ?? 'Sign-in failed');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(googleAuthServiceProvider).signIn();
      ref.invalidate(sessionControllerProvider);
      ref.invalidate(consoleControllerProvider);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = userFacingErrorOrNull(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openWeb(String path) async {
    final uri = Uri.parse('${AppEnv.appUrl}$path');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final googleReady = AppEnv.googleServerClientId.isNotEmpty;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final short = constraints.maxHeight < 560;
            final hPad = Responsive.horizontalPadding(context) < 24
                ? 24.0
                : Responsive.horizontalPadding(context);
            final pad = EdgeInsets.fromLTRB(
              hPad,
              short ? 16 : 40,
              hPad,
              short ? 16 : 32,
            );
            final minBodyHeight = constraints.maxHeight - pad.vertical;
            return SingleChildScrollView(
              padding: pad,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: minBodyHeight > 0 ? minBodyHeight : 0,
                ),
                child: Center(
                  child: ConstrainedBox(
                    // web max-w-[23rem] at 14px root ≈ 322; widen slightly on tablets
                    constraints: BoxConstraints(
                      maxWidth: constraints.maxWidth >= 600 ? 400 : 322,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Center(child: OneSignLogo(height: 32)),
                        SizedBox(height: short ? 20 : 40),
                        if (_step == _LoginStep.email)
                          _EmailStep(
                            emailController: _email,
                            emailFocus: _emailFocus,
                            loading: _loading,
                            error: _error,
                            googleReady: googleReady,
                            onGoogle: _google,
                            onContinue: _continueEmail,
                            onSignUp: () => _openWeb('/signup'),
                          )
                        else
                          _PasswordStep(
                            email: _email.text.trim(),
                            passwordController: _password,
                            passwordFocus: _passwordFocus,
                            showPassword: _showPassword,
                            loading: _loading,
                            error: _error,
                            onBack: _resetToEmail,
                            onTogglePassword: () =>
                                setState(() => _showPassword = !_showPassword),
                            onForgot: () => _openWeb(
                              '/forgot-password?email=${Uri.encodeComponent(_email.text.trim())}',
                            ),
                            onSignIn: _signIn,
                            onSignUp: () => _openWeb('/signup'),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _EmailStep extends StatelessWidget {
  const _EmailStep({
    required this.emailController,
    required this.emailFocus,
    required this.loading,
    required this.error,
    required this.googleReady,
    required this.onGoogle,
    required this.onContinue,
    required this.onSignUp,
  });

  final TextEditingController emailController;
  final FocusNode emailFocus;
  final bool loading;
  final String? error;
  final bool googleReady;
  final VoidCallback onGoogle;
  final VoidCallback onContinue;
  final VoidCallback onSignUp;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Welcome back',
          textAlign: TextAlign.center,
          style: Brand.text(
            fontSize: 24.5,
            fontWeight: FontWeight.w800,
            color: Brand.neutral900,
            letterSpacing: -0.61,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Sign in to your OneSign console',
          textAlign: TextAlign.center,
          style: Brand.text(
            fontSize: 13.125,
            color: Brand.neutral500,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),
        if (googleReady) ...[
          _GoogleButton(loading: loading, onPressed: onGoogle),
          const SizedBox(height: 20),
          const _OrEmailDivider(),
          const SizedBox(height: 20),
        ],
        if (error != null) ...[
          _ErrorBanner(message: error!),
          const SizedBox(height: 16),
        ],
        Text(
          'Email',
          style: Brand.text(
            fontSize: 12.25,
            fontWeight: FontWeight.w600,
            color: Brand.neutral700,
          ),
        ),
        const SizedBox(height: 6),
        _AuthField(
          controller: emailController,
          focusNode: emailFocus,
          enabled: !loading,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.go,
          autofillHints: const [AutofillHints.email],
          placeholder: 'you@company.com',
          onSubmitted: (_) => onContinue(),
        ),
        const SizedBox(height: 16),
        _PrimaryButton(
          label: loading ? 'Checking…' : 'Continue',
          loading: loading,
          onPressed: loading ? null : onContinue,
        ),
        const SizedBox(height: 36),
        _SignUpFooter(onSignUp: onSignUp),
      ],
    );
  }
}

class _PasswordStep extends StatelessWidget {
  const _PasswordStep({
    required this.email,
    required this.passwordController,
    required this.passwordFocus,
    required this.showPassword,
    required this.loading,
    required this.error,
    required this.onBack,
    required this.onTogglePassword,
    required this.onForgot,
    required this.onSignIn,
    required this.onSignUp,
  });

  final String email;
  final TextEditingController passwordController;
  final FocusNode passwordFocus;
  final bool showPassword;
  final bool loading;
  final String? error;
  final VoidCallback onBack;
  final VoidCallback onTogglePassword;
  final VoidCallback onForgot;
  final VoidCallback onSignIn;
  final VoidCallback onSignUp;

  @override
  Widget build(BuildContext context) {
    final initial = email.isNotEmpty ? email[0].toUpperCase() : '?';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: GestureDetector(
            onTap: loading ? null : onBack,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.chevron_left, size: 16, color: Brand.neutral500),
                Text(
                  'Back',
                  style: Brand.text(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Brand.neutral500,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Enter your password',
          textAlign: TextAlign.center,
          style: Brand.text(
            fontSize: 24.5,
            fontWeight: FontWeight.w800,
            color: Brand.neutral900,
            letterSpacing: -0.61,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 20),
        if (error != null) ...[
          _ErrorBanner(message: error!),
          const SizedBox(height: 16),
        ],
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: Brand.neutral50,
            borderRadius: BorderRadius.circular(10.5),
            border: Border.all(color: Brand.neutral200),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Brand.theme.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  initial,
                  style: Brand.text(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Brand.theme,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  email,
                  overflow: TextOverflow.ellipsis,
                  style: Brand.text(fontSize: 14, color: Brand.neutral700),
                ),
              ),
              GestureDetector(
                onTap: loading ? null : onBack,
                child: Text(
                  'Change',
                  style: Brand.text(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Brand.theme,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Password',
          style: Brand.text(
            fontSize: 12.25,
            fontWeight: FontWeight.w600,
            color: Brand.neutral700,
          ),
        ),
        const SizedBox(height: 6),
        _AuthField(
          controller: passwordController,
          focusNode: passwordFocus,
          enabled: !loading,
          obscureText: !showPassword,
          textInputAction: TextInputAction.go,
          autofillHints: const [AutofillHints.password],
          placeholder: 'Enter your password',
          onSubmitted: (_) => onSignIn(),
          suffix: IconButton(
            onPressed: onTogglePassword,
            icon: Icon(
              showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 18,
              color: Brand.neutral400,
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: onForgot,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.only(top: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Forgot password?',
              style: Brand.text(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Brand.theme,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        _PrimaryButton(
          label: loading ? 'Signing in…' : 'Sign in',
          loading: loading,
          onPressed: loading ? null : onSignIn,
        ),
        const SizedBox(height: 36),
        _SignUpFooter(onSignUp: onSignUp),
      ],
    );
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.loading, required this.onPressed});

  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10.5),
          side: const BorderSide(color: Brand.gray200),
        ),
        child: InkWell(
          onTap: loading ? null : onPressed,
          borderRadius: BorderRadius.circular(10.5),
          child: Opacity(
            opacity: loading ? 0.7 : 1,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SvgPicture.asset(
                  'assets/images/google_g.svg',
                  width: 18,
                  height: 18,
                ),
                const SizedBox(width: 10),
                Text(
                  loading ? 'Redirecting…' : 'Continue with Google',
                  style: Brand.text(
                    fontSize: 13.125,
                    fontWeight: FontWeight.w600,
                    color: Brand.gray800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OrEmailDivider extends StatelessWidget {
  const _OrEmailDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: Brand.neutral200, height: 1, thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'OR EMAIL',
            style: Brand.text(
              fontSize: 9.625,
              fontWeight: FontWeight.w500,
              color: Brand.neutral400,
              letterSpacing: 0.48,
              fontFamily: 'Courier',
            ),
          ),
        ),
        const Expanded(child: Divider(color: Brand.neutral200, height: 1, thickness: 1)),
      ],
    );
  }
}

class _AuthField extends StatelessWidget {
  const _AuthField({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.placeholder,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.obscureText = false,
    this.onSubmitted,
    this.suffix,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final String placeholder;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool obscureText;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        enabled: enabled,
        obscureText: obscureText,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        autofillHints: autofillHints,
        autocorrect: false,
        onSubmitted: onSubmitted,
        style: Brand.text(fontSize: 16, color: Brand.neutral900),
        cursorColor: Brand.theme,
        decoration: InputDecoration(
          hintText: placeholder,
          hintStyle: Brand.text(fontSize: 16, color: Brand.neutral400),
          filled: true,
          fillColor: Brand.neutral50,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          suffixIcon: suffix,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10.5),
            borderSide: const BorderSide(color: Brand.neutral200),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10.5),
            borderSide: const BorderSide(color: Brand.neutral200),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10.5),
            borderSide: const BorderSide(color: Brand.theme, width: 1.5),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10.5),
            borderSide: const BorderSide(color: Brand.neutral200),
          ),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 41,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: Brand.theme,
          foregroundColor: Brand.contrast,
          disabledBackgroundColor: Brand.theme.withValues(alpha: 0.6),
          disabledForegroundColor: Brand.contrast,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.5)),
          elevation: 0,
          padding: EdgeInsets.zero,
        ),
        child: loading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Brand.contrast),
              )
            : Text(
                label,
                style: Brand.text(
                  fontSize: 13.125,
                  fontWeight: FontWeight.w600,
                  color: Brand.contrast,
                ),
              ),
      ),
    );
  }
}

class _SignUpFooter extends StatelessWidget {
  const _SignUpFooter({required this.onSignUp});

  final VoidCallback onSignUp;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'New to OneSign? ',
          style: Brand.text(fontSize: 12.25, color: Brand.neutral500),
        ),
        GestureDetector(
          onTap: onSignUp,
          child: Text(
            'Sign up',
            style: Brand.text(
              fontSize: 12.25,
              fontWeight: FontWeight.w600,
              color: Brand.theme,
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10.5),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(
        message,
        style: Brand.text(fontSize: 13, color: const Color(0xFFB91C1C), height: 1.35),
      ),
    );
  }
}

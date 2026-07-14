import 'package:flutter/material.dart';

/// Brand tokens mirrored from web `apps/web/app/globals.css` (`--theme: #047857`).
abstract final class Brand {
  /// `--theme` — primary actions, active accents, links
  static const Color theme = Color(0xFF047857);

  /// Logo tile + "TV" accent (`LOGO_ACCENT` on web)
  static const Color logoAccent = Color(0xFF087958);

  /// Wordmark on light surfaces
  static const Color wordmark = Color(0xFF111827);

  /// `--theme-contrast` ≈ near-white for text on solid theme
  static const Color contrast = Color(0xFFF5FBF9);

  /// `--theme-hover` ≈ theme mixed 15% toward black
  static final Color hover = Color.lerp(theme, const Color(0xFF000000), 0.15)!;

  /// `--theme-soft` ≈ 15% theme on white (selected nav pill, chips)
  static final Color soft = Color.lerp(const Color(0xFFFFFFFF), theme, 0.15)!;

  /// `--theme-softer` ≈ 10% theme on white
  static final Color softer = Color.lerp(const Color(0xFFFFFFFF), theme, 0.10)!;

  /// `--theme-foreground-strong` ≈ theme 40% + black
  static final Color foregroundStrong =
      Color.lerp(const Color(0xFF000000), theme, 0.40)!;

  /// `--theme-shell-dark`
  static final Color shellDark =
      Color.lerp(const Color(0xFF000000), theme, 0.28)!;

  static const Color neutral900 = Color(0xFF171717);
  static const Color neutral700 = Color(0xFF404040);
  static const Color neutral500 = Color(0xFF737373);
  static const Color neutral400 = Color(0xFFA3A3A3);
  static const Color neutral200 = Color(0xFFE5E5E5);
  static const Color gray200 = Color(0xFFE5E7EB);
  static const Color gray800 = Color(0xFF1F2937);
  static const Color neutral50 = Color(0xFFFAFAFA);

  static const String fontFamily = 'Inter';

  static TextStyle text({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color color = neutral900,
    double? letterSpacing,
    double? height,
    String? fontFamily,
  }) {
    return TextStyle(
      fontFamily: fontFamily ?? Brand.fontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  /// Full Material theme — brand green for nav pill, FAB, buttons, switches, etc.
  static ThemeData light() {
    final softest = Color.lerp(const Color(0xFFFFFFFF), theme, 0.05)!;

    final scheme = ColorScheme(
      brightness: Brightness.light,
      primary: theme,
      onPrimary: contrast,
      primaryContainer: soft,
      onPrimaryContainer: foregroundStrong,
      secondary: theme,
      onSecondary: contrast,
      secondaryContainer: soft,
      onSecondaryContainer: theme,
      tertiary: logoAccent,
      onTertiary: contrast,
      tertiaryContainer: softer,
      onTertiaryContainer: foregroundStrong,
      error: const Color(0xFFB91C1C),
      onError: Colors.white,
      errorContainer: const Color(0xFFFEF2F2),
      onErrorContainer: const Color(0xFFB91C1C),
      surface: Colors.white,
      onSurface: neutral900,
      onSurfaceVariant: neutral500,
      surfaceContainerHighest: softest,
      outline: neutral200,
      outlineVariant: gray200,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: shellDark,
      onInverseSurface: contrast,
      inversePrimary: soft,
      surfaceTint: theme,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.white,
      fontFamily: fontFamily,
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        fontFamily: fontFamily,
        bodyColor: neutral900,
        displayColor: neutral900,
      ),
      primaryTextTheme: base.primaryTextTheme.apply(fontFamily: fontFamily),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: neutral900,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        titleTextStyle: text(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: neutral900,
        ),
        iconTheme: const IconThemeData(color: neutral900),
      ),
      // Match web sidebar: deep shell fill + brand-green active pill + light labels.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: shellDark,
        surfaceTintColor: Colors.transparent,
        indicatorColor: theme,
        elevation: 0,
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            size: 24,
            color: selected
                ? Colors.white
                : Colors.white.withValues(alpha: 0.72),
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return text(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected
                ? Colors.white
                : Colors.white.withValues(alpha: 0.72),
          );
        }),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: shellDark,
        indicatorColor: theme,
        selectedIconTheme: const IconThemeData(size: 24, color: Colors.white),
        unselectedIconTheme: IconThemeData(
          size: 24,
          color: Colors.white.withValues(alpha: 0.72),
        ),
        selectedLabelTextStyle: text(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        unselectedLabelTextStyle: text(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: Colors.white.withValues(alpha: 0.72),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: theme,
        foregroundColor: contrast,
        extendedTextStyle: text(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: contrast,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: theme,
          foregroundColor: contrast,
          disabledBackgroundColor: theme.withValues(alpha: 0.6),
          disabledForegroundColor: contrast,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.5)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: theme),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: theme,
          side: const BorderSide(color: gray200),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.5)),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return theme;
          return null;
        }),
        checkColor: const WidgetStatePropertyAll(contrast),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return theme;
          return null;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return soft;
          return null;
        }),
        trackOutlineColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return theme;
          return Brand.neutral200;
        }),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: theme),
      chipTheme: ChipThemeData(
        selectedColor: soft,
        checkmarkColor: theme,
        labelStyle: text(fontSize: 12, fontWeight: FontWeight.w600),
        secondaryLabelStyle:
            text(fontSize: 12, fontWeight: FontWeight.w600, color: theme),
      ),
      inputDecorationTheme: InputDecorationTheme(
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10.5),
          borderSide: const BorderSide(color: theme, width: 1.5),
        ),
        focusColor: theme,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        textStyle: text(fontSize: 14, color: neutral900),
      ),
      listTileTheme: const ListTileThemeData(
        selectedColor: theme,
        iconColor: neutral500,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: theme,
        unselectedLabelColor: neutral500,
        indicatorColor: theme,
      ),
      dividerTheme: const DividerThemeData(color: neutral200),
    );
  }
}

import 'package:flutter/material.dart';

/// Adaptive layout for phones, tablets, and orientation changes.
///
/// Prefers Material-style breakpoints + content max-width over per-widget
/// scale plugins, so existing Material lists keep working while wide and
/// short screens get better chrome and density.
abstract final class Responsive {
  /// Phone / narrow phone (Material compact).
  static const double compactMax = 600;

  /// Large phone / small tablet (Material medium).
  static const double mediumMax = 840;

  /// Comfortable reading width for console lists.
  static const double contentMax = 720;

  /// Wider reading width on large tablets / landscape.
  static const double contentMaxWide = 960;

  /// Bottom inset so FAB.extended does not cover list rows.
  static const double fabClearance = 88;

  static Size sizeOf(BuildContext context) => MediaQuery.sizeOf(context);

  static bool isCompact(BuildContext context) =>
      sizeOf(context).width < compactMax;

  static bool isLandscape(BuildContext context) =>
      MediaQuery.orientationOf(context) == Orientation.landscape;

  /// Short canvas (typical phone landscape / fold).
  static bool isShortHeight(BuildContext context) =>
      sizeOf(context).height < 500;

  static bool isPhoneLandscapeSize(Size size) =>
      size.shortestSide < compactMax && size.width > size.height;

  /// Side nav on tablet-width, or on landscape phones that are wide enough.
  static bool useNavigationRail(BuildContext context) =>
      useNavigationRailFor(sizeOf(context));

  static bool useNavigationRailFor(Size size) {
    if (size.width >= compactMax) return true;
    return isPhoneLandscapeSize(size) && size.width >= 560;
  }

  /// Icon-only on short / phone-landscape; otherwise selected or all labels.
  static NavigationRailLabelType railLabelType(BuildContext context) =>
      railLabelTypeFor(sizeOf(context));

  static NavigationRailLabelType railLabelTypeFor(Size size) {
    if (isPhoneLandscapeSize(size) || size.height < 500) {
      return NavigationRailLabelType.none;
    }
    if (size.width < mediumMax) return NavigationRailLabelType.selected;
    return NavigationRailLabelType.all;
  }

  /// Denser toolbar when vertical space is tight.
  static double appBarHeight(BuildContext context) =>
      isShortHeight(context) ? 48 : kToolbarHeight;

  /// Prefer side-by-side empty-state copy + CTA on wide short screens.
  static bool useWideEmptyState(BuildContext context) {
    final size = sizeOf(context);
    return size.width >= 560 && size.height < 560;
  }

  static double contentMaxWidth(BuildContext context) =>
      contentMaxWidthFor(sizeOf(context).width);

  static double contentMaxWidthFor(double width) {
    if (width >= mediumMax) return contentMaxWide;
    if (width >= compactMax) return contentMax;
    return width;
  }

  static int gridColumns(
    BuildContext context, {
    int compact = 2,
    int medium = 3,
    int expanded = 4,
  }) =>
      gridColumnsFor(
        sizeOf(context).width,
        compact: compact,
        medium: medium,
        expanded: expanded,
      );

  static int gridColumnsFor(
    double width, {
    int compact = 2,
    int medium = 3,
    int expanded = 4,
  }) {
    if (width >= mediumMax) return expanded;
    if (width >= compactMax) return medium;
    return compact;
  }

  /// Horizontal page inset that grows on wider canvases.
  static double horizontalPadding(BuildContext context) =>
      horizontalPaddingFor(sizeOf(context).width);

  static double horizontalPaddingFor(double width) {
    if (width >= mediumMax) return 32;
    if (width >= compactMax) return 24;
    return 16;
  }

  static EdgeInsets pagePadding(
    BuildContext context, {
    bool fab = false,
    double top = 16,
  }) {
    final size = sizeOf(context);
    final h = horizontalPaddingFor(size.width);
    final short = size.height < 500;
    return EdgeInsets.fromLTRB(
      h,
      short ? (top * 0.5).clamp(4, top) : top,
      h,
      fab ? fabClearance : 16,
    );
  }

  /// List / scroll padding used by FAB pages.
  static EdgeInsets listPadding(BuildContext context, {bool fab = false}) {
    final h = horizontalPadding(context);
    return EdgeInsets.fromLTRB(h, 8, h, fab ? fabClearance : 16);
  }

  static double sheetHeightFactor(BuildContext context) {
    final size = sizeOf(context);
    if (size.height < 500) return 0.92;
    if (isLandscape(context)) return 0.85;
    return 0.7;
  }

  static NavigationDestinationLabelBehavior navLabelBehavior(
    BuildContext context,
  ) {
    if (sizeOf(context).width < 360) {
      return NavigationDestinationLabelBehavior.onlyShowSelected;
    }
    return NavigationDestinationLabelBehavior.alwaysShow;
  }

  static double navBarHeight(BuildContext context) {
    if (sizeOf(context).height < 500) return 56;
    return 68;
  }

  /// Soft-clamp system font scale so layouts stay usable without ignoring a11y.
  static TextScaler clampedTextScaler(TextScaler scaler) =>
      scaler.clamp(minScaleFactor: 0.85, maxScaleFactor: 1.3);

  /// AppBar workspace chip width so title + actions do not collide.
  static double workspaceChipMaxWidth(BuildContext context) {
    final width = sizeOf(context).width;
    if (width < 360) return 72;
    if (width < 400) return 100;
    if (width < 600) return 140;
    return 200;
  }
}

/// Centers [child] and caps width on tablets / landscape.
class ResponsiveBody extends StatelessWidget {
  const ResponsiveBody({
    super.key,
    required this.child,
    this.alignment = Alignment.topCenter,
  });

  final Widget child;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: Responsive.contentMaxWidth(context),
        ),
        child: child,
      ),
    );
  }
}

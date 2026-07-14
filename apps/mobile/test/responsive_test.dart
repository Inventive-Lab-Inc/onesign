import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onesign_console/core/theme/responsive.dart';

void main() {
  group('Responsive.useNavigationRailFor', () {
    test('uses bottom bar on portrait phones', () {
      expect(
        Responsive.useNavigationRailFor(const Size(390, 844)),
        isFalse,
      );
    });

    test('uses rail on tablets', () {
      expect(
        Responsive.useNavigationRailFor(const Size(768, 1024)),
        isTrue,
      );
    });

    test('uses rail on wide landscape phones', () {
      expect(
        Responsive.useNavigationRailFor(const Size(844, 390)),
        isTrue,
      );
    });
  });

  group('Responsive.railLabelTypeFor', () {
    test('hides labels on phone landscape', () {
      expect(
        Responsive.railLabelTypeFor(const Size(844, 390)),
        NavigationRailLabelType.none,
      );
    });

    test('shows selected label on medium portrait tablets', () {
      expect(
        Responsive.railLabelTypeFor(const Size(768, 1024)),
        NavigationRailLabelType.selected,
      );
    });

    test('shows all labels on wide canvases', () {
      expect(
        Responsive.railLabelTypeFor(const Size(1024, 768)),
        NavigationRailLabelType.all,
      );
    });
  });

  group('Responsive.contentMaxWidthFor', () {
    test('is unbounded-by-token on phones (full width)', () {
      expect(Responsive.contentMaxWidthFor(390), 390);
    });

    test('caps medium widths', () {
      expect(Responsive.contentMaxWidthFor(700), Responsive.contentMax);
    });

    test('caps wide widths', () {
      expect(Responsive.contentMaxWidthFor(1200), Responsive.contentMaxWide);
    });
  });

  group('Responsive.gridColumnsFor', () {
    test('scales with width', () {
      expect(Responsive.gridColumnsFor(390), 2);
      expect(Responsive.gridColumnsFor(700), 3);
      expect(Responsive.gridColumnsFor(900), 4);
    });
  });

  group('Responsive.horizontalPaddingFor', () {
    test('grows on wider canvases', () {
      expect(Responsive.horizontalPaddingFor(390), 16);
      expect(Responsive.horizontalPaddingFor(700), 24);
      expect(Responsive.horizontalPaddingFor(900), 32);
    });
  });

  group('Responsive.clampedTextScaler', () {
    test('clamps extreme scale factors', () {
      final huge = Responsive.clampedTextScaler(const TextScaler.linear(2));
      expect(huge.scale(10), lessThanOrEqualTo(13.0001));

      final tiny = Responsive.clampedTextScaler(const TextScaler.linear(0.5));
      expect(tiny.scale(10), greaterThanOrEqualTo(8.499));
    });
  });
}

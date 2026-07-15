import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Exact OneSign TV lockup from web `Logo` (height 32 on login).
class OneSignLogo extends StatelessWidget {
  const OneSignLogo({super.key, this.height = 32});

  final double height;

  static const _aspect = 1008 / 214;

  @override
  Widget build(BuildContext context) {
    final width = height * _aspect;
    return Semantics(
      label: 'OneSign TV',
      child: SvgPicture.asset(
        'assets/images/onesign_tv_lockup.svg',
        height: height,
        width: width,
        fit: BoxFit.contain,
        alignment: Alignment.centerLeft,
        placeholderBuilder: (_) => _LogoFallback(height: height),
      ),
    );
  }
}

/// Fallback composed lockup if SVG fails to decode.
class _LogoFallback extends StatelessWidget {
  const _LogoFallback({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final mark = height;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset(
          'assets/images/onesign_mark.svg',
          height: mark,
          width: mark * (211.48 / 198.04),
        ),
        SizedBox(width: height * 0.22),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: 'OneSign',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontWeight: FontWeight.w700,
                  fontSize: height * 0.72,
                  color: const Color(0xFF111827),
                  height: 1,
                ),
              ),
              WidgetSpan(
                alignment: PlaceholderAlignment.top,
                child: Padding(
                  padding:
                      EdgeInsets.only(left: height * 0.06, top: height * 0.02),
                  child: Text(
                    'TV',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                      fontSize: height * 0.38,
                      color: const Color(0xFF087958),
                      height: 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

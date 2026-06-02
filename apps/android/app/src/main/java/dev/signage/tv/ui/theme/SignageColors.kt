package dev.signage.tv.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Must stay aligned with `--theme` and derived tokens in [apps/web/app/globals.css].
 * Change [Theme] only; other values mirror the web admin dashboard palette.
 */
object SignageColors {
    val Theme = Color(0xFF047857)
    val ThemeContrast = Color(0xFFF5FAF8)
    val ThemeShellDark = Color(0xFF012218)
    val ThemeShellLight = Color(0xFF023E2D)
    val ThemeForegroundOnDark = Color(0xFF63AB97)
    val ThemeForegroundOnDarkSoft = Color(0xFF96BFB2)
}

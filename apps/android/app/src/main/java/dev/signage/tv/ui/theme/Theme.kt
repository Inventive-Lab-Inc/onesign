package dev.signage.tv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val signageColors =
    darkColorScheme(
        primary = SignageColors.Theme,
        onPrimary = SignageColors.ThemeContrast,
        background = SignageColors.ThemeShellDark,
        onBackground = SignageColors.ThemeForegroundOnDark,
        surface = SignageColors.ThemeShellLight,
        onSurface = SignageColors.ThemeForegroundOnDark,
    )

@Composable
fun SignageTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = signageColors, typography = Typography, content = content)
}

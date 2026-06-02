package dev.signage.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import dev.signage.tv.ui.theme.SignageColors

/** Shell gradient from the admin dashboard layout background. */
@Composable
fun SignageShellBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(SignageColors.ThemeShellDark, SignageColors.ThemeShellLight),
                        start = Offset.Zero,
                        end = Offset(1000f, 700f),
                    ),
                ),
        content = content,
    )
}

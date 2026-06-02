package dev.signage.tv

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.signage.tv.ui.SignageBrandMark
import dev.signage.tv.ui.theme.SignageColors

/**
 * Full-screen standby when playback is paused or waiting for content — brand mark, app name, short status.
 */
@Composable
fun TvStandbyBrandingScreen(
    message: String,
    hint: String? = null,
    footerContent: (@Composable () -> Unit)? = null,
) {
    Box(
        modifier = Modifier.fillMaxSize().padding(48.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            SignageBrandMark(
                boxWidth = 102.dp,
                boxHeight = 96.dp,
                cornerRadius = 9.dp,
                iconSize = 54.dp,
            )
            Spacer(modifier = Modifier.height(28.dp))
            Text(
                text = stringResource(R.string.brand_name),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = SignageColors.ThemeContrast,
                textAlign = TextAlign.Center,
            )
            Text(
                text = stringResource(R.string.brand_subtitle),
                style = MaterialTheme.typography.labelSmall,
                color = SignageColors.ThemeContrast.copy(alpha = 0.45f),
                letterSpacing = 1.4.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(32.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = SignageColors.ThemeForegroundOnDark,
                textAlign = TextAlign.Center,
            )
            if (hint != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = hint,
                    style = MaterialTheme.typography.bodyMedium,
                    color = SignageColors.ThemeForegroundOnDarkSoft,
                    textAlign = TextAlign.Center,
                )
            }
            footerContent?.invoke()
        }
    }
}

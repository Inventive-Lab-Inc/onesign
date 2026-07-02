package dev.signage.tv

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import dev.signage.tv.ui.TvBrandedScreenLayout
import dev.signage.tv.ui.TvStandbyStatusIcon
import dev.signage.tv.ui.theme.SignageColors

/**
 * Branded standby — logo lockup, status icon, title, and optional helper.
 * Matches web [TvPlayerBrandStandby].
 */
@Composable
fun TvStandbyBrandingScreen(
    badge: String,
    hint: String? = null,
    footerContent: (@Composable () -> Unit)? = null,
) {
    TvBrandedScreenLayout {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(80.dp)
                        .border(1.dp, Color.White.copy(alpha = 0.15f), CircleShape)
                        .background(Color.White.copy(alpha = 0.04f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                TvStandbyStatusIcon(badge = badge)
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = badge,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 34.sp,
                ),
                color = Color.White,
                textAlign = TextAlign.Center,
            )

            if (hint != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = hint,
                    style = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp),
                    color = Color.White.copy(alpha = 0.45f),
                    textAlign = TextAlign.Center,
                )
            }

            footerContent?.invoke()
        }
    }
}

@Composable
fun TvStandbyPrimaryAction(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    androidx.compose.material3.Button(
        onClick = onClick,
        modifier = modifier.padding(top = 16.dp),
        shape = RoundedCornerShape(8.dp),
        colors =
            androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = SignageColors.Theme,
                contentColor = SignageColors.ThemeContrast,
            ),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        )
    }
}

@Composable
fun TvStandbyBlockScreen(reason: PlaybackBlockReason) {
    TvStandbyBrandingScreen(
        badge = stringResource(reason.badgeRes),
        hint = stringResource(reason.hintRes),
    )
}

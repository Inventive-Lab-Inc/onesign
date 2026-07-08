package dev.signage.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.signage.tv.R
import dev.signage.tv.ui.theme.SignageColors

private val setupSteps =
    listOf(
        R.string.device_setup_step_open_settings,
        R.string.device_setup_step_allow_installs,
        R.string.device_setup_step_return,
    )

@Composable
fun DeviceSetupScreen(
    installPermissionGranted: Boolean,
    onOpenSettingsClick: () -> Unit,
    onContinueClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TvBrandedScreenLayout(modifier = modifier) {
        val metrics = LocalBrandedScreenMetrics.current
        val scale = metrics.scale
        val titleFontSize =
            if (metrics.isShortViewport && !metrics.isCompact) {
                20.sp * scale
            } else {
                32.sp * metrics.iconScale
            }
        val contentWidthFraction =
            when {
                metrics.isCompact -> 0.94f
                metrics.isShortViewport -> 0.78f
                else -> 0.56f
            }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(contentWidthFraction),
        ) {
            Text(
                text = stringResource(R.string.device_setup_title),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = SignageColors.ThemeForegroundOnDark,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(32.dp * scale))
            setupSteps.forEachIndexed { index, stepRes ->
                if (index > 0) {
                    Spacer(modifier = Modifier.height(24.dp * scale))
                }
                SetupStepRow(
                    number = index + 1,
                    text = stringResource(stepRes),
                    isActive = index == 0,
                    scale = metrics.iconScale,
                )
            }
            Spacer(modifier = Modifier.height(40.dp * scale))
            if (installPermissionGranted) {
                Text(
                    text = stringResource(R.string.device_setup_permission_granted),
                    style = MaterialTheme.typography.bodyLarge.copy(fontSize = 18.sp * scale),
                    color = SignageColors.Theme,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(20.dp * scale))
                DeviceSetupPrimaryButton(
                    label = stringResource(R.string.device_setup_continue),
                    onClick = onContinueClick,
                    scale = scale,
                )
            } else {
                DeviceSetupPrimaryButton(
                    label = stringResource(R.string.device_setup_open_settings),
                    onClick = onOpenSettingsClick,
                    scale = scale,
                )
            }
        }
    }
}

@Composable
private fun SetupStepRow(
    number: Int,
    text: String,
    isActive: Boolean,
    scale: Float,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp * scale)
                    .border(
                        width = 1.dp,
                        color =
                            if (isActive) {
                                SignageColors.Theme
                            } else {
                                SignageColors.Theme.copy(alpha = 0.3f)
                            },
                        shape = CircleShape,
                    )
                    .background(
                        color = if (isActive) SignageColors.Theme else Color.Transparent,
                        shape = CircleShape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = number.toString(),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 16.sp * scale),
                color = if (isActive) SignageColors.ThemeContrast else SignageColors.ThemeForegroundOnDark,
            )
        }
        Spacer(modifier = Modifier.width(16.dp * scale))
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge.copy(fontSize = 26.sp * scale),
            color =
                if (isActive) {
                    SignageColors.ThemeForegroundOnDark
                } else {
                    SignageColors.ThemeForegroundOnDarkSoft
                },
            fontWeight = if (isActive) FontWeight.Medium else FontWeight.Normal,
        )
    }
}

@Composable
private fun DeviceSetupPrimaryButton(
    label: String,
    onClick: () -> Unit,
    scale: Float,
) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(8.dp),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = SignageColors.Theme,
                contentColor = SignageColors.ThemeContrast,
            ),
        modifier = Modifier.padding(horizontal = 40.dp * scale),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 16.sp * scale),
            modifier = Modifier.padding(horizontal = 24.dp * scale, vertical = 4.dp * scale),
        )
    }
}

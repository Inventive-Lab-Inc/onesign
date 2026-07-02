package dev.signage.tv.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.signage.tv.R
import dev.signage.tv.ui.theme.SignageColors

enum class SlideLoadProgressStyle {
    Ring,
    Banner,
}

@Composable
fun SlideLoadProgressOverlay(
    fileLabel: String,
    percent: Int?,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    headline: String? = null,
    style: SlideLoadProgressStyle = SlideLoadProgressStyle.Banner,
) {
    when (style) {
        SlideLoadProgressStyle.Ring ->
            TvCacheProgressRing(
                percent = percent,
                headline = headline ?: stringResource(R.string.slide_loading_playlist_cache),
                subtitle = subtitle,
                modifier = modifier,
            )

        SlideLoadProgressStyle.Banner -> {
            val title = headline ?: stringResource(R.string.slide_loading_file, fileLabel)
            Column(
                modifier =
                    modifier
                        .fillMaxWidth(0.62f)
                        .background(SignageColors.ThemeShellDark.copy(alpha = 0.88f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 28.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                if (percent == null) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(44.dp),
                        color = SignageColors.Theme,
                    )
                } else {
                    androidx.compose.material3.LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth(),
                        progress = { percent / 100f },
                        color = SignageColors.Theme,
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "$percent%",
                        style = MaterialTheme.typography.titleMedium,
                        color = SignageColors.ThemeForegroundOnDark,
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = SignageColors.ThemeForegroundOnDarkSoft,
                    textAlign = TextAlign.Center,
                )
                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = SignageColors.ThemeForegroundOnDarkSoft.copy(alpha = 0.85f),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

/** Circular cache ring — matches web TvPlayerLoadProgressOverlay. */
@Composable
fun TvCacheProgressRing(
    percent: Int?,
    headline: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    val clampedPercent = percent?.coerceIn(0, 100)
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(120.dp)) {
            if (clampedPercent == null) {
                CircularProgressIndicator(
                    modifier = Modifier.size(40.dp),
                    color = Color.White,
                    strokeWidth = 2.dp,
                )
            } else {
                val stroke = 4.dp
                Canvas(modifier = Modifier.size(120.dp)) {
                    val radius = (size.minDimension - stroke.toPx()) / 2f
                    drawCircle(
                        color = Color.White.copy(alpha = 0.12f),
                        radius = radius,
                        style = Stroke(width = stroke.toPx()),
                    )
                    drawArc(
                        color = Color.White,
                        startAngle = -90f,
                        sweepAngle = 360f * (clampedPercent / 100f),
                        useCenter = false,
                        style = Stroke(width = stroke.toPx(), cap = StrokeCap.Round),
                    )
                }
                Text(
                    text = "$clampedPercent%",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Medium),
                    color = Color.White,
                )
            }
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = headline,
            style = MaterialTheme.typography.titleMedium,
            color = Color.White.copy(alpha = 0.55f),
            textAlign = TextAlign.Center,
        )
        if (subtitle != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.4f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

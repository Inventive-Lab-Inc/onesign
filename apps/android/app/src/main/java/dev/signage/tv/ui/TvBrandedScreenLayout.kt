package dev.signage.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Shared TV shell — logo lockup pinned to the top on every branded screen. */
object TvBrandedScreenLayoutDefaults {
    val horizontalPadding = 48.dp
    val verticalPadding = 40.dp

    /** Reference viewport the TV design was authored against (Compose preview size). */
    val referenceWidth = 960.dp
    val referenceHeight = 540.dp

    /** Below this width we treat the surface as a phone and widen content blocks. */
    val compactWidthThreshold = 600.dp

    const val minScale = 0.42f
    const val maxScale = 1f
}

/**
 * Responsive metrics for branded screens. [scale] preserves the TV design at the reference
 * viewport (1.0) and shrinks proportionally on smaller surfaces so nothing overflows or wraps.
 * [isCompact] is true on phone-sized widths, where content blocks should use a wider fraction.
 */
data class BrandedScreenMetrics(
    val scale: Float,
    val isCompact: Boolean,
    /** True when height is below the TV reference (e.g. phone landscape). */
    val isShortViewport: Boolean = false,
    /** Logo lockup height — on phones stays readable instead of shrinking with [scale]. */
    val logoHeight: Dp = 52.dp,
) {
    /** Scales icons/text with the logo on compact surfaces where [scale] alone is too small. */
    val iconScale: Float
        get() = if (isCompact) (logoHeight.value / 52f).coerceIn(0.68f, 1f) else scale
}

val LocalBrandedScreenMetrics =
    staticCompositionLocalOf { BrandedScreenMetrics(scale = 1f, isCompact = false) }

@Composable
fun TvBrandedScreenLayout(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val widthScale = maxWidth / TvBrandedScreenLayoutDefaults.referenceWidth
        val heightScale = maxHeight / TvBrandedScreenLayoutDefaults.referenceHeight
        val scale =
            minOf(widthScale, heightScale)
                .coerceIn(TvBrandedScreenLayoutDefaults.minScale, TvBrandedScreenLayoutDefaults.maxScale)
        val isCompact = maxWidth < TvBrandedScreenLayoutDefaults.compactWidthThreshold
        val isShortViewport = maxHeight < TvBrandedScreenLayoutDefaults.referenceHeight
        val logoHeight =
            if (isCompact || isShortViewport) {
                // Width-proportional on phones (portrait + landscape) so the lockup stays legible.
                (maxWidth * 0.68f / OneSignTvLogoAspectRatio).coerceIn(36.dp, 52.dp)
            } else {
                52.dp * scale
            }
        val logoToContentSpacing =
            when {
                isCompact -> 28.dp
                isShortViewport -> (maxHeight * 0.1f).coerceIn(32.dp, 48.dp)
                else -> 0.dp
            }
        val horizontalPadding =
            if (isCompact) {
                24.dp
            } else {
                TvBrandedScreenLayoutDefaults.horizontalPadding * scale
            }
        val verticalPadding =
            if (isCompact) {
                24.dp
            } else {
                TvBrandedScreenLayoutDefaults.verticalPadding * scale
            }

        CompositionLocalProvider(
            LocalBrandedScreenMetrics provides
                BrandedScreenMetrics(
                    scale = scale,
                    isCompact = isCompact,
                    isShortViewport = isShortViewport,
                    logoHeight = logoHeight,
                ),
        ) {
            if (isCompact) {
                // Phone: keep logo and screen content in one centered block — avoids a huge gap
                // between a tiny top logo and vertically-centered pairing/setup content.
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    SignageBrandHeaderTv()
                    Spacer(modifier = Modifier.height(logoToContentSpacing))
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        content = content,
                    )
                }
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    SignageBrandHeaderTv()
                    if (logoToContentSpacing > 0.dp) {
                        Spacer(modifier = Modifier.height(logoToContentSpacing))
                    }
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement =
                            if (isShortViewport) {
                                // Bias content below the logo — pure centering bunches the title under the lockup.
                                Arrangement.spacedBy(0.dp, Alignment.Top)
                            } else {
                                Arrangement.Center
                            },
                        content =
                            if (isShortViewport) {
                                {
                                    Spacer(modifier = Modifier.weight(1.35f))
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.fillMaxWidth(),
                                        content = content,
                                    )
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            } else {
                                content
                            },
                    )
                }
            }
        }
    }
}

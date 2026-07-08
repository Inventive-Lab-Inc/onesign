package dev.signage.tv.ui

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import dev.signage.tv.R
import dev.signage.tv.ui.theme.SignageTvTheme

/** Matches web [Logo] viewBox aspect ratio. */
const val OneSignTvLogoAspectRatio = 1008f / 214f

/**
 * OneSign TV brand lockup — same SVG art as web [Logo] (green tile + wordmark + TV).
 * Light tone for dark TV surfaces.
 */
@Composable
fun OneSignTvLogo(
    height: Dp,
    modifier: Modifier = Modifier,
    contentDescription: String = "OneSign TV",
) {
    val context = LocalContext.current

    AsyncImage(
        model =
            ImageRequest.Builder(context)
                .data(R.raw.onesign_tv_logo_light)
                .decoderFactory(SvgDecoder.Factory())
                .build(),
        contentDescription = contentDescription,
        contentScale = ContentScale.Fit,
        modifier =
            modifier
                .height(height)
                .aspectRatio(OneSignTvLogoAspectRatio),
    )
}

/** TV-scale lockup for pairing, standby, and setup screens — matches web full-scale logo height. */
@Composable
fun OneSignTvLogoHeader(modifier: Modifier = Modifier) {
    val logoHeight = LocalBrandedScreenMetrics.current.logoHeight
    OneSignTvLogo(height = logoHeight, modifier = modifier)
}

@Preview(showBackground = true, widthDp = 960, heightDp = 120, backgroundColor = 0xFF012218)
@Composable
private fun OneSignTvLogoHeaderPreview() {
    SignageTvTheme {
        OneSignTvLogoHeader()
    }
}

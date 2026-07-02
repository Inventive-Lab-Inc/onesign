package dev.signage.tv.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import dev.signage.tv.ui.theme.SignageTvTheme

/** TV-scale hero row — same OneSign TV SVG lockup as web [TvPlayerBrandHeader]. */
@Composable
fun SignageBrandHeaderTv(modifier: Modifier = Modifier) {
    OneSignTvLogoHeader(modifier = modifier)
}

@Preview(showBackground = true, widthDp = 960, heightDp = 540, backgroundColor = 0xFF012218)
@Composable
private fun SignageBrandHeaderTvPreview() {
    SignageTvTheme {
        SignageBrandHeaderTv()
    }
}

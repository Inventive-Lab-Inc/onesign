package dev.signage.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dev.signage.tv.ui.theme.SignageTvTheme

/** OneSign TV logo watermark during trial playback — logo only on a black badge. */
@Composable
fun TrialWatermarkOverlay(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .padding(20.dp)
                .background(Color.Black, RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        OneSignTvLogo(height = 28.dp)
    }
}

@Preview(showBackground = true, widthDp = 320, heightDp = 120, backgroundColor = 0xFF012218)
@Composable
private fun TrialWatermarkOverlayPreview() {
    SignageTvTheme {
        TrialWatermarkOverlay()
    }
}

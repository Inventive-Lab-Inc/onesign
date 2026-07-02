package dev.signage.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.signage.tv.R

/** OneSign logo watermark shown on TV playback during an active trial. */
@Composable
fun TrialWatermarkOverlay(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .padding(20.dp)
                .background(Color.Black.copy(alpha = 0.42f), RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SignageBrandMark(
            boxWidth = 36.dp,
            boxHeight = 34.dp,
            cornerRadius = 5.dp,
            iconSize = 20.dp,
        )
        Text(
            text = stringResource(R.string.brand_name),
            modifier = Modifier.padding(start = 8.dp),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
        )
    }
}

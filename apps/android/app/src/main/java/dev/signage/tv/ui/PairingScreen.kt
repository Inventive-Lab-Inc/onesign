package dev.signage.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
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

private val pairingLinkSteps =
    listOf(
        R.string.pairing_link_step_sign_in,
        R.string.pairing_link_step_screens,
        R.string.pairing_link_step_add_screen,
    )

fun formatPairingCodeGroups(code: String): Pair<String, String> {
    val digits = code.filter { it.isDigit() }.take(6).padStart(6, '0')
    return digits.take(3) to digits.drop(3)
}

@Composable
fun PairingScreen(
    pairingCode: String,
    showWaitingIndicator: Boolean,
    modifier: Modifier = Modifier,
) {
    val (firstGroup, secondGroup) = formatPairingCodeGroups(pairingCode)

    TvBrandedScreenLayout(modifier = modifier) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(0.8f),
        ) {
            Text(
                text = stringResource(R.string.pairing_title),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Medium,
                ),
                color = Color.White,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(40.dp))

            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = firstGroup,
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontSize = 88.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 2.sp,
                    ),
                    color = Color.White,
                )
                Text(
                    text = "·",
                    modifier = Modifier.padding(horizontal = 24.dp),
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Light,
                    ),
                    color = Color.White.copy(alpha = 0.25f),
                )
                Text(
                    text = secondGroup,
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontSize = 88.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 2.sp,
                    ),
                    color = Color.White,
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(start = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                pairingLinkSteps.forEachIndexed { index, stepRes ->
                    PairingLinkStep(number = index + 1, text = stringResource(stepRes))
                }
            }

            if (showWaitingIndicator) {
                Spacer(modifier = Modifier.height(32.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White.copy(alpha = 0.7f),
                        strokeWidth = 2.dp,
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = stringResource(R.string.pairing_waiting),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White.copy(alpha = 0.55f),
                    )
                }
            }
        }
    }
}

@Composable
private fun PairingLinkStep(
    number: Int,
    text: String,
) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "$number.",
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 20.sp),
            color = Color.White.copy(alpha = 0.35f),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 20.sp),
            color = Color.White.copy(alpha = 0.55f),
            textAlign = TextAlign.Start,
        )
    }
}

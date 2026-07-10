package dev.signage.tv.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.signage.tv.R

fun formatPairingCodeGroups(code: String): Pair<String, String> {
    val digits = code.filter { it.isDigit() }.take(6).padStart(6, '0')
    return digits.take(3) to digits.drop(3)
}

fun normalizePairingCode(code: String): String =
    code.filter { it.isDigit() }.take(6).padStart(6, '0')

private fun copyPairingCodeToClipboard(context: Context, pairingCode: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("pairing_code", pairingCode))
    Toast.makeText(context, context.getString(R.string.pairing_copied), Toast.LENGTH_SHORT).show()
}

@Composable
fun PairingScreen(
    pairingCode: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val rawPairingCode = normalizePairingCode(pairingCode)
    val (firstGroup, secondGroup) = formatPairingCodeGroups(pairingCode)

    TvBrandedScreenLayout(modifier = modifier) {
        val metrics = LocalBrandedScreenMetrics.current
        val scale = metrics.scale
        val titleFontSize =
            if (metrics.isShortViewport && !metrics.isCompact) {
                20.sp * scale
            } else {
                32.sp * scale
            }
        val titleToCodeGap =
            if (metrics.isShortViewport && !metrics.isCompact) {
                24.dp * scale
            } else {
                40.dp * scale
            }
        val instructionFontSize = 20.sp * scale

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(if (metrics.isCompact) 0.94f else 0.8f),
        ) {
            Text(
                text = stringResource(R.string.pairing_title),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = titleFontSize,
                    fontWeight = FontWeight.Medium,
                ),
                color = Color.White,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(titleToCodeGap))

            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            copyPairingCodeToClipboard(context, rawPairingCode)
                        }
                        .semantics {
                            role = Role.Button
                            contentDescription = "Pairing code $rawPairingCode"
                        },
            ) {
                Text(
                    text = firstGroup,
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontSize = 88.sp * scale,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 2.sp * scale,
                    ),
                    color = Color.White,
                    maxLines = 1,
                    softWrap = false,
                )
                Spacer(modifier = Modifier.width(36.dp * scale))
                Text(
                    text = secondGroup,
                    style = MaterialTheme.typography.displayLarge.copy(
                        fontSize = 88.sp * scale,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 2.sp * scale,
                    ),
                    color = Color.White,
                    maxLines = 1,
                    softWrap = false,
                )
            }

            Spacer(modifier = Modifier.height(32.dp * scale))

            Text(
                text = stringResource(R.string.pairing_link_instruction),
                style =
                    MaterialTheme.typography.titleMedium.copy(
                        fontSize = instructionFontSize,
                        lineHeight = 24.sp * scale,
                    ),
                color = Color.White.copy(alpha = 0.55f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

package dev.signage.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.signage.tv.R
import dev.signage.tv.ui.theme.GoogleSansFontFamily
import dev.signage.tv.ui.theme.SignageColors
import dev.signage.tv.ui.theme.SignageTvTheme

/**
 * Matches the web admin [AuthBrandHeader] hero row — green tile, app name, and subtitle side by side.
 */
@Composable
fun SignageBrandHeader(
    modifier: Modifier = Modifier,
    onDark: Boolean = true,
    boxWidth: Dp = 64.dp,
    boxHeight: Dp = 60.dp,
    cornerRadius: Dp = 8.dp,
    iconSize: Dp = 32.dp,
    markToTextGap: Dp = 16.dp,
    nameFontSize: Float = 26f,
    subtitleFontSize: Float = 12f,
) {
    val nameColor = if (onDark) SignageColors.ThemeContrast else SignageColors.ThemeShellDark
    val subtitleColor =
        if (onDark) {
            SignageColors.ThemeContrast.copy(alpha = 0.75f)
        } else {
            SignageColors.ThemeForegroundOnDarkSoft
        }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SignageBrandMark(
            boxWidth = boxWidth,
            boxHeight = boxHeight,
            cornerRadius = cornerRadius,
            iconSize = iconSize,
        )
        Spacer(modifier = Modifier.width(markToTextGap))
        Column {
            Text(
                text = stringResource(R.string.brand_name),
                fontFamily = GoogleSansFontFamily,
                fontSize = nameFontSize.sp,
                fontWeight = FontWeight.Bold,
                color = nameColor,
                letterSpacing = (-0.01f * nameFontSize).sp,
                lineHeight = (nameFontSize * 1.15f).sp,
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = stringResource(R.string.brand_subtitle).uppercase(),
                fontFamily = GoogleSansFontFamily,
                fontSize = subtitleFontSize.sp,
                fontWeight = FontWeight.Normal,
                color = subtitleColor,
                letterSpacing = (0.08f * subtitleFontSize).sp,
                textAlign = TextAlign.Start,
            )
        }
    }
}

/** TV-scale hero row for pairing and full-screen standby surfaces. */
@Composable
fun SignageBrandHeaderTv(modifier: Modifier = Modifier, onDark: Boolean = true) {
    SignageBrandHeader(
        modifier = modifier,
        onDark = onDark,
        boxWidth = 102.dp,
        boxHeight = 96.dp,
        cornerRadius = 8.dp,
        iconSize = 54.dp,
        markToTextGap = 24.dp,
        nameFontSize = 34f,
        subtitleFontSize = 14f,
    )
}

@Preview(showBackground = true, widthDp = 960, heightDp = 540, backgroundColor = 0xFF012218)
@Composable
private fun SignageBrandHeaderTvPreview() {
    SignageTvTheme {
        SignageBrandHeaderTv()
    }
}

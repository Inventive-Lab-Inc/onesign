package dev.signage.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.signage.tv.R
import dev.signage.tv.ui.theme.SignageColors

/** Matches the admin dashboard [BrandMark] — green tile with TV icon. */
@Composable
fun SignageBrandMark(
    modifier: Modifier = Modifier,
    boxWidth: Dp = 68.dp,
    boxHeight: Dp = 64.dp,
    cornerRadius: Dp = 6.dp,
    iconSize: Dp = 36.dp,
) {
    Box(
        modifier =
            modifier
                .size(width = boxWidth, height = boxHeight)
                .background(SignageColors.Theme, RoundedCornerShape(cornerRadius)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_brand_tv),
            contentDescription = null,
            tint = SignageColors.ThemeContrast,
            modifier = Modifier.size(iconSize),
        )
    }
}

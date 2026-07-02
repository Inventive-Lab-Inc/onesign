package dev.signage.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Shared TV shell — logo lockup pinned to the top on every branded screen. */
object TvBrandedScreenLayoutDefaults {
    val horizontalPadding = 48.dp
    val verticalPadding = 40.dp
}

@Composable
fun TvBrandedScreenLayout(
    modifier: Modifier = Modifier,
    horizontalPadding: Dp = TvBrandedScreenLayoutDefaults.horizontalPadding,
    verticalPadding: Dp = TvBrandedScreenLayoutDefaults.verticalPadding,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(horizontal = horizontalPadding, vertical = verticalPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SignageBrandHeaderTv()
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            content = content,
        )
    }
}

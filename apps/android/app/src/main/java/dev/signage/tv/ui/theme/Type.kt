package dev.signage.tv.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import dev.signage.tv.R

/** Same family as the web app (`@fontsource-variable/google-sans`, latin wght). */
val GoogleSansFontFamily =
    FontFamily(
        Font(R.font.google_sans, FontWeight.Normal),
        Font(R.font.google_sans, FontWeight.Medium),
        Font(R.font.google_sans, FontWeight.SemiBold),
        Font(R.font.google_sans, FontWeight.Bold),
    )

private fun TextStyle.googleSans(): TextStyle = copy(fontFamily = GoogleSansFontFamily)

val Typography =
    with(Typography()) {
        copy(
            displayLarge = displayLarge.googleSans().copy(fontWeight = FontWeight.Bold, fontSize = 56.sp),
            headlineMedium = headlineMedium.googleSans().copy(fontWeight = FontWeight.Bold),
            titleLarge = titleLarge.googleSans().copy(fontWeight = FontWeight.SemiBold, fontSize = 28.sp),
            bodyLarge = bodyLarge.googleSans().copy(fontSize = 18.sp),
            bodyMedium = bodyMedium.googleSans(),
            labelSmall = labelSmall.googleSans(),
        )
    }

package dev.signage.tv.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bedtime
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ImageNotSupported
import androidx.compose.material.icons.outlined.Pause
import androidx.compose.material.icons.outlined.PowerSettingsNew
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Tv
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon

/** Matches web [resolveStandbyIcon] in tv-player-branding.tsx. */
fun resolveTvStandbyIcon(badge: String): ImageVector {
    val haystack = badge.lowercase()
    if (haystack.contains("screen disabled") || haystack.contains("playback disabled") || haystack == "off") {
        return Icons.Outlined.PowerSettingsNew
    }
    if (haystack.contains("plan limit") || haystack == "paused") {
        return Icons.Outlined.Pause
    }
    if (haystack.contains("account suspended") || haystack == "suspended") {
        return Icons.Outlined.Shield
    }
    if (haystack.contains("off-hours")) {
        return Icons.Outlined.Bedtime
    }
    if (haystack == "empty") {
        return Icons.Outlined.ImageNotSupported
    }
    if (haystack.contains("no playlist")) {
        return Icons.Outlined.Tv
    }
    if (haystack.contains("can't start") || haystack.contains("can't connect") || haystack.contains("pairing cleared") || haystack.contains("secure connection")) {
        return Icons.Outlined.ErrorOutline
    }
    return Icons.Outlined.Tv
}

@Composable
fun TvStandbyStatusIcon(
    badge: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    tint: Color = Color.White.copy(alpha = 0.85f),
) {
    Icon(
        imageVector = resolveTvStandbyIcon(badge),
        contentDescription = null,
        modifier = modifier.size(size),
        tint = tint,
    )
}

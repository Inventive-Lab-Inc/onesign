package dev.signage.tv

/** Playlist-wide background cache progress (shown while warming new manifest media). */
data class MediaCacheProgressState(
    val itemsReady: Int,
    val itemsTotal: Int,
    val currentLabel: String?,
    val currentPercent: Int?,
    val overallPercent: Int,
    val isWarming: Boolean,
)

fun computeOverallWarmPercent(
    counts: PlaylistCacheCounts,
    currentFilePercent: Int?,
): Int {
    if (counts.itemsTotal <= 0) {
        return 100
    }
    val partial = (currentFilePercent ?: 0).coerceIn(0, 100) / 100f
    val effectiveReady = counts.itemsReady.toFloat() + partial
    return ((effectiveReady / counts.itemsTotal.toFloat()) * 100f)
        .toInt()
        .coerceIn(0, 100)
}

fun mediaFileLabel(url: String): String =
    url.substringAfterLast('/').substringBefore('?').takeIf { it.isNotBlank() } ?: url

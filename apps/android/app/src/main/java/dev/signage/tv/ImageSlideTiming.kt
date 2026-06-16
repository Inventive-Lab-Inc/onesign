package dev.signage.tv

/** Matches console playlist duration field (1–120 seconds for still images). */
private const val DEFAULT_IMAGE_SLIDE_SECONDS = 8
private const val MIN_IMAGE_SLIDE_SECONDS = 1
private const val MAX_IMAGE_SLIDE_SECONDS = 120

/**
 * Milliseconds to wait after the transition before advancing. Transition time is included in
 * [durationSeconds] so a 1s console setting yields ~1s on screen total.
 */
internal fun imageSlideDwellMs(durationSeconds: Int?, fadeInMillis: Int): Long {
    val slideMs =
        (durationSeconds ?: DEFAULT_IMAGE_SLIDE_SECONDS)
            .coerceIn(MIN_IMAGE_SLIDE_SECONDS, MAX_IMAGE_SLIDE_SECONDS) * 1000L
    return (slideMs - fadeInMillis.coerceAtLeast(0).toLong()).coerceAtLeast(0L)
}

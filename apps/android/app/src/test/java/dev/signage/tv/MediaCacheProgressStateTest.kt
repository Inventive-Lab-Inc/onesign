package dev.signage.tv

import org.junit.Assert.assertEquals
import org.junit.Test

class MediaCacheProgressStateTest {
    @Test
    fun computeOverallWarmPercent_countsPartialCurrentFile() {
        val counts =
            PlaylistCacheCounts(
                itemsTotal = 4,
                itemsReady = 1,
                videosTotal = 2,
                videosReady = 1,
                imagesTotal = 2,
                imagesReady = 0,
            )
        assertEquals(37, computeOverallWarmPercent(counts, currentFilePercent = 50))
    }

    @Test
    fun computeOverallWarmPercent_returns100WhenEmptyPlaylist() {
        val counts =
            PlaylistCacheCounts(
                itemsTotal = 0,
                itemsReady = 0,
                videosTotal = 0,
                videosReady = 0,
                imagesTotal = 0,
                imagesReady = 0,
            )
        assertEquals(100, computeOverallWarmPercent(counts, currentFilePercent = null))
    }
}

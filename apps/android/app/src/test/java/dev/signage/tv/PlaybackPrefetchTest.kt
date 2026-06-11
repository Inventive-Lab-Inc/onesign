package dev.signage.tv

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackPrefetchTest {
    private val videoA = PlaybackSlide(url = "https://cdn.example/a.mp4", fileType = "video")
    private val videoB = PlaybackSlide(url = "https://cdn.example/b.mp4", fileType = "video")
    private val image = PlaybackSlide(url = "https://cdn.example/a.jpg", fileType = "image")

    @Test
    fun prefetchesNextVideoWhenDifferentUrl() {
        assertTrue(shouldPrefetchNextVideoSlide(0, listOf(videoA, videoB)))
    }

    @Test
    fun skipsPrefetchForSingleVideoPlaylist() {
        assertFalse(shouldPrefetchNextVideoSlide(0, listOf(videoA)))
    }

    @Test
    fun skipsPrefetchWhenNextSlideIsSameUrl() {
        assertFalse(shouldPrefetchNextVideoSlide(0, listOf(videoA, videoA)))
    }

    @Test
    fun skipsPrefetchWhenNextSlideIsImage() {
        assertFalse(shouldPrefetchNextVideoSlide(0, listOf(videoA, image)))
    }
}

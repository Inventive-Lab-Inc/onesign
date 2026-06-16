package dev.signage.tv

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageSlideTimingTest {
    @Test
    fun oneSecondWithNoTransition() {
        assertEquals(1000L, imageSlideDwellMs(1, 0))
    }

    @Test
    fun oneSecondWithFadeIncludedInTotal() {
        assertEquals(550L, imageSlideDwellMs(1, 450))
    }

    @Test
    fun nullDurationDefaultsToEightSeconds() {
        assertEquals(8000L, imageSlideDwellMs(null, 0))
    }

    @Test
    fun subSecondValuesClampToOneSecond() {
        assertEquals(1000L, imageSlideDwellMs(0, 0))
    }
}

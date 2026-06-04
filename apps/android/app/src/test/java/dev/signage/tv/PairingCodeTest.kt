package dev.signage.tv

import org.junit.Assert.assertEquals
import org.junit.Test

class PairingCodeTest {
    @Test
    fun formatPairingCodeFromBucket_padsToSixDigits() {
        assertEquals("000000", formatPairingCodeFromBucket(0))
        assertEquals("000001", formatPairingCodeFromBucket(1))
        assertEquals("000123", formatPairingCodeFromBucket(123))
        assertEquals("999999", formatPairingCodeFromBucket(999_999))
    }

    @Test(expected = IllegalArgumentException::class)
    fun formatPairingCodeFromBucket_rejectsNegative() {
        formatPairingCodeFromBucket(-1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun formatPairingCodeFromBucket_rejectsMillion() {
        formatPairingCodeFromBucket(1_000_000)
    }
}

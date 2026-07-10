package dev.signage.tv

import dev.signage.tv.ui.formatPairingCodeGroups
import dev.signage.tv.ui.normalizePairingCode
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

    @Test
    fun formatPairingCodeGroups_splitsIntoTwoThrees() {
        assertEquals("378" to "694", formatPairingCodeGroups("378694"))
        assertEquals("000" to "001", formatPairingCodeGroups("1"))
    }

    @Test
    fun normalizePairingCode_padsToSixDigits() {
        assertEquals("378694", normalizePairingCode("378694"))
        assertEquals("000001", normalizePairingCode("1"))
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

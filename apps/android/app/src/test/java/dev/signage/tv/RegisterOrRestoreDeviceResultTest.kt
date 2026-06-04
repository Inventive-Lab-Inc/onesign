package dev.signage.tv

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RegisterOrRestoreDeviceResultTest {
    private val json =
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

    @Test
    fun decodes_restored_linked_device() {
        val payload =
            """
            {
              "device_id": "089fb741-7ac6-4593-8f99-0d8767a2a78b",
              "is_new": false,
              "status": "online",
              "pairing_code": "378694",
              "owner_id": "11111111-1111-1111-1111-111111111111",
              "playback_disabled": false
            }
            """.trimIndent()

        val result = json.decodeFromString(RegisterOrRestoreDeviceResult.serializer(), payload)

        assertEquals("089fb741-7ac6-4593-8f99-0d8767a2a78b", result.deviceId)
        assertFalse(result.isNew)
        assertEquals("378694", result.pairingCode)
        // owner_id present => screen was already linked, so the TV skips the pairing code.
        assertEquals("11111111-1111-1111-1111-111111111111", result.ownerId)
    }

    @Test
    fun decodes_new_device_with_null_owner() {
        val payload =
            """
            {
              "device_id": "1dfca66e-dc09-4048-8123-52f9347facce",
              "is_new": true,
              "status": "pending_pairing",
              "pairing_code": "393897",
              "owner_id": null,
              "playback_disabled": false
            }
            """.trimIndent()

        val result = json.decodeFromString(RegisterOrRestoreDeviceResult.serializer(), payload)

        assertTrue(result.isNew)
        assertEquals("393897", result.pairingCode)
        // No owner => unlinked, so the TV must show the pairing code.
        assertNull(result.ownerId)
    }
}

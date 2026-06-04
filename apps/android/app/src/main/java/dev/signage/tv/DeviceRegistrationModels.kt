package dev.signage.tv

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Result of [register_or_restore_device]. When [ownerId] is non-null the screen was already linked
 * (restored by hardware id after a reinstall), so the TV resumes playback without showing [pairingCode].
 */
@Serializable
data class RegisterOrRestoreDeviceResult(
    @SerialName("device_id") val deviceId: String,
    @SerialName("is_new") val isNew: Boolean = false,
    val status: String? = null,
    @SerialName("pairing_code") val pairingCode: String,
    @SerialName("owner_id") val ownerId: String? = null,
    @SerialName("playback_disabled") val playbackDisabled: Boolean = false,
)

@Serializable
data class DeviceRow(
    val id: String,
    @SerialName("owner_id") val ownerId: String? = null,
    @SerialName("pairing_code") val pairingCode: String,
    val name: String? = null,
    val status: String,
    @SerialName("screen_orientation") val screenOrientation: String = "landscape",
)

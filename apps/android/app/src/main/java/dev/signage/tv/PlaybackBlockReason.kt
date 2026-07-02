package dev.signage.tv

import androidx.annotation.StringRes

/** Why playback is blocked — maps to on-screen badge + helper copy. */
enum class PlaybackBlockReason(
    @StringRes val badgeRes: Int,
    @StringRes val hintRes: Int,
) {
    AdminDisabled(R.string.device_disabled_by_admin, R.string.standby_playback_off_hint),
    PausedByQuota(R.string.standby_paused, R.string.standby_paused_hint),
    AccountSuspended(R.string.standby_suspended, R.string.standby_suspended_hint),
}

fun parsePlaybackBlockReason(raw: String?): PlaybackBlockReason? =
    when (raw) {
        "admin_disabled" -> PlaybackBlockReason.AdminDisabled
        "paused_by_quota" -> PlaybackBlockReason.PausedByQuota
        "account_suspended" -> PlaybackBlockReason.AccountSuspended
        else -> null
    }

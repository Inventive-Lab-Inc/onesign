package dev.signage.tv

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity

/**
 * One-time device checks before pairing and OTA updates.
 * Normal manifest permissions (network, boot) are granted at install time.
 */
object DeviceSetupRequirements {
    fun needsInstallPermissionGrant(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return false
        }
        return !context.packageManager.canRequestPackageInstalls()
    }

    fun openInstallPermissionSettings(activity: ComponentActivity): Boolean {
        val settingsIntent =
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${activity.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        return runCatching { activity.startActivity(settingsIntent) }.isSuccess
    }
}

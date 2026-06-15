package dev.signage.tv

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.Window
import androidx.activity.ComponentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.math.roundToInt

private const val MAX_LIVE_SCREENSHOT_WIDTH_PX = 960
private const val LIVE_SCREENSHOT_WEBP_QUALITY = 78

suspend fun ComponentActivity.captureLiveScreenshotWebP(): ByteArray? {
    val window = window ?: return null
    val decor = window.decorView
    if (decor.width <= 0 || decor.height <= 0) {
        return null
    }

    val bitmap =
        captureWithPixelCopy(window) ?: captureWithCanvas(decor)

    return try {
        encodeLiveScreenshotWebP(bitmap)
    } finally {
        bitmap.recycle()
    }
}

private suspend fun captureWithPixelCopy(window: Window): Bitmap? =
    suspendCancellableCoroutine { cont ->
        val decor = window.decorView
        val bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
        PixelCopy.request(
            window,
            bitmap,
            { result ->
                if (result == PixelCopy.SUCCESS) {
                    cont.resume(bitmap)
                } else {
                    bitmap.recycle()
                    cont.resume(null)
                }
            },
            Handler(Looper.getMainLooper()),
        )
    }

private fun captureWithCanvas(decor: android.view.View): Bitmap {
    val bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    decor.draw(canvas)
    return bitmap
}

private fun encodeLiveScreenshotWebP(source: Bitmap): ByteArray? {
    val scaled =
        if (source.width <= MAX_LIVE_SCREENSHOT_WIDTH_PX) {
            source
        } else {
            val targetHeight =
                (source.height.toFloat() * MAX_LIVE_SCREENSHOT_WIDTH_PX / source.width.toFloat())
                    .roundToInt()
                    .coerceAtLeast(1)
            Bitmap.createScaledBitmap(source, MAX_LIVE_SCREENSHOT_WIDTH_PX, targetHeight, true)
        }

    return try {
        val stream = java.io.ByteArrayOutputStream()
        val format =
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                Bitmap.CompressFormat.WEBP_LOSSY
            } else {
                @Suppress("DEPRECATION")
                Bitmap.CompressFormat.WEBP
            }
        if (!scaled.compress(format, LIVE_SCREENSHOT_WEBP_QUALITY, stream)) {
            null
        } else {
            stream.toByteArray()
        }
    } finally {
        if (scaled !== source) {
            scaled.recycle()
        }
    }
}

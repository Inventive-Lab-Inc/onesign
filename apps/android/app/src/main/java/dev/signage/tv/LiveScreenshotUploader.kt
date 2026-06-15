package dev.signage.tv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object LiveScreenshotUploader {
    suspend fun upload(
        deviceId: String,
        webpBytes: ByteArray,
        accessToken: String,
    ): Boolean =
        withContext(Dispatchers.IO) {
            val base = BuildConfig.CONSOLE_BASE_URL.trim().trimEnd('/')
            if (base.isBlank()) {
                return@withContext false
            }

            val body =
                MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("deviceId", deviceId)
                    .addFormDataPart(
                        "file",
                        "live.webp",
                        webpBytes.toRequestBody("image/webp".toMediaType()),
                    )
                    .build()

            val request =
                Request.Builder()
                    .url("$base/api/devices/live-screenshot")
                    .addHeader("Authorization", "Bearer $accessToken")
                    .post(body)
                    .build()

            SignageOkHttpClient.instance.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        }
}

package dev.signage.tv

import android.app.Application
import androidx.media3.common.util.UnstableApi
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import okio.Path.Companion.toOkioPath

@UnstableApi
class SignageTvApp : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        // Initialize Media3 cache early. If this fails, we log it but don't crash, 
        // as MainViewModel will retry initialization later.
        runCatching {
            MediaCacheProvider.getSimpleCache(this)
        }.onFailure {
            android.util.Log.e("SignageTvApp", "Early SimpleCache init failed", it)
        }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient(SignageOkHttpClient.instance)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.10)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("coil_image_cache").toOkioPath())
                    .maxSizePercent(0.05)
                    .build()
            }
            .build()
    }
}

package dev.signage.tv

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * After the playlist manifest switches (instant UI update), fills the disk cache for every slide.
 * Current and next slides are warmed first; playback is never blocked.
 */
class PlaylistMediaCacheCoordinator(
    private val app: Application,
    private val scope: CoroutineScope,
    private val exoProvider: () -> SignageExoController?,
    private val onProgressChanged: (MediaCacheProgressState?) -> Unit = {},
) {
    private val logTag = "SignagePlaylistCache"
    private val mainHandler = Handler(Looper.getMainLooper())
    private var imageWarmJob: Job? = null
    private var lastScheduledRevision: String? = null
    private var lastStartIndex: Int = 0
    private var activeSlides: List<PlaybackSlide> = emptyList()
    private var activeRevision: String? = null
    private var currentDownloadLabel: String? = null
    private var currentDownloadPercent: Int? = null

    fun bindExoCallbacks() {
        exoProvider()?.onVideoPrefetchProgress = { url, percent ->
            currentDownloadLabel = mediaFileLabel(url)
            currentDownloadPercent = percent
            publishProgress()
        }
    }

    fun onPlaybackActive(
        slides: List<PlaybackSlide>,
        contentRevision: String?,
        startIndex: Int,
    ) {
        if (slides.isEmpty()) {
            cancelAll()
            lastScheduledRevision = null
            lastStartIndex = 0
            activeSlides = emptyList()
            activeRevision = null
            publishProgress(clear = true)
            return
        }

        val revisionKey = contentRevision?.takeIf { it.isNotBlank() } ?: slides.joinToString("|") { it.url }
        val exo = exoProvider() ?: return
        activeSlides = slides
        activeRevision = contentRevision

        val plan = playlistWarmOrder(slides, startIndex)
        val immediateVideos =
            videoUrlsToWarmCache(
                currentIndex = startIndex,
                slides = slides,
                activelyPlayingVideoUrl = exo.currentlyPlayingVideoUrl(),
            )
        val immediateImages = imageUrlsToWarmCache(startIndex, slides)

        exo.cancelVideoPrefetchExcept(plan.videoUrls.toSet())
        immediateVideos.forEach { exo.requestPrefetchVideo(it) }

        val revisionChanged = revisionKey != lastScheduledRevision
        val startIndexChanged = startIndex != lastStartIndex

        if (revisionChanged) {
            Log.i(
                logTag,
                "Playlist cache warm started rev=$revisionKey videos=${plan.videoUrls.size} images=${plan.imageUrls.size} startIndex=$startIndex",
            )
            lastScheduledRevision = revisionKey
            exo.schedulePrioritizedVideoWarm(plan.videoUrls)
            restartImageWarm(plan.imageUrls)
        } else if (startIndexChanged) {
            immediateImages.forEach { url ->
                prefetchImagePriority(url)
            }
            immediateVideos.forEach { exo.requestPrefetchVideo(it) }
        }

        lastStartIndex = startIndex
        publishProgress()
    }

    private fun restartImageWarm(imageUrls: List<String>) {
        imageWarmJob?.cancel()
        if (imageUrls.isEmpty()) {
            imageWarmJob = null
            return
        }
        imageWarmJob =
            scope.launch(Dispatchers.IO) {
                warmImagesParallel(imageUrls, MAX_CONCURRENT_IMAGE_PREFETCH)
            }
    }

    private fun prefetchImagePriority(url: String) {
        if (url.isBlank() || PlaylistCacheStatus.isImageDiskCached(app, url)) {
            return
        }
        scope.launch(Dispatchers.IO) {
            warmImagesParallel(listOf(url), maxConcurrent = 1)
        }
    }

    private suspend fun warmImagesParallel(
        imageUrls: List<String>,
        maxConcurrent: Int,
    ) {
        val pending =
            imageUrls.filter { url ->
                url.isBlank().not() && !PlaylistCacheStatus.isImageDiskCached(app, url)
            }
        if (pending.isEmpty()) {
            publishProgress()
            return
        }
        val queue = Channel<String>(Channel.UNLIMITED)
        pending.forEach { queue.send(it) }
        queue.close()
        val loader = app.imageLoader
        coroutineScope {
            repeat(maxConcurrent.coerceAtLeast(1)) {
                launch(Dispatchers.IO) {
                    for (url in queue) {
                        if (!isActive) {
                            return@launch
                        }
                        currentDownloadLabel = mediaFileLabel(url)
                        currentDownloadPercent = null
                        publishProgress()
                        runCatching {
                            loader.execute(
                                ImageRequest.Builder(app)
                                    .data(url)
                                    .build(),
                            )
                        }.onFailure { e ->
                            Log.d(logTag, "Image playlist warm failed: $url", e)
                        }
                        currentDownloadPercent = 100
                        publishProgress()
                    }
                }
            }
        }
        currentDownloadLabel = null
        currentDownloadPercent = null
        publishProgress()
    }

    private fun publishProgress(clear: Boolean = false) {
        val publish =
            Runnable {
                if (clear || activeSlides.isEmpty()) {
                    onProgressChanged(null)
                    return@Runnable
                }
                val counts =
                    computePlaylistCacheCounts(
                        slides = activeSlides,
                        isVideoReady = { url -> PlaylistCacheStatus.isVideoFullyCached(app, url) },
                        isImageReady = { url -> PlaylistCacheStatus.isImageDiskCached(app, url) },
                    )
                val warming = isWarming()
                if (!warming && counts.itemsReady >= counts.itemsTotal) {
                    onProgressChanged(null)
                    return@Runnable
                }
                onProgressChanged(
                    MediaCacheProgressState(
                        itemsReady = counts.itemsReady,
                        itemsTotal = counts.itemsTotal,
                        currentLabel = currentDownloadLabel,
                        currentPercent = currentDownloadPercent,
                        overallPercent = computeOverallWarmPercent(counts, currentDownloadPercent),
                        isWarming = warming,
                    ),
                )
            }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            publish.run()
        } else {
            mainHandler.post(publish)
        }
    }

    fun cancelAll() {
        imageWarmJob?.cancel()
        imageWarmJob = null
        currentDownloadLabel = null
        currentDownloadPercent = null
        exoProvider()?.onVideoPrefetchProgress = null
        exoProvider()?.cancelPlaylistVideoWarm()
        exoProvider()?.cancelVideoPrefetchExcept(emptySet())
        publishProgress(clear = true)
    }

    /** True while playlist image warm or Exo background video caching is in progress. */
    fun isWarming(): Boolean {
        if (imageWarmJob?.isActive == true) {
            return true
        }
        return exoProvider()?.isBackgroundVideoCachingActive() == true
    }

    companion object {
        private const val MAX_CONCURRENT_IMAGE_PREFETCH = 3
    }
}

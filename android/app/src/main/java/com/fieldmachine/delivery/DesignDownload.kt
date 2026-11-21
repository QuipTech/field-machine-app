package com.fieldmachine.delivery

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request

/** One file of a delivery; [activeGeneration] is the stop() counter when it was requested. */
data class DesignJob(
  val scope: String,
  val delivery: String,
  val project: String,
  val path: String,
  val index: Long,
  val size: Long,
  val sha256: String,
  val url: String,
  val activeGeneration: Long,
)

/**
 * Android counterpart of windows/FieldMachine/Native/DesignDeliveryDownload.cpp.
 * Resumes from partials/<index>.part with a Range request, verifies SHA-256,
 * then moves the file into place. Returns the same result words as Windows:
 * verified, retry, expired, permanent, checksum, or path.
 */
class DesignDownload(private val context: Context, private val generation: AtomicLong) {
  /** Thrown for local storage failures, which Windows reports as "permanent". */
  private class StorageFailure : Exception()

  // Separate client so stop() can cancel downloads without touching Portal uploads.
  // OkHttp has no response cache unless one is configured.
  private val client: OkHttpClient =
    OkHttpClient.Builder()
      .followRedirects(false)
      .followSslRedirects(false)
      .callTimeout(900, TimeUnit.SECONDS)
      .build()

  fun cancelAll() = client.dispatcher.cancelAll()

  fun run(job: DesignJob): String =
    try {
      download(job)
    } catch (error: IllegalArgumentException) {
      "path"
    } catch (error: StorageFailure) {
      "permanent"
    } catch (error: Exception) {
      "retry"
    }

  private fun DesignJob.isStopped() = generation.get() != activeGeneration

  private fun download(job: DesignJob): String {
    if (job.isStopped()) return "retry"
    val version = DesignStorage.version(context, job.scope, job.project, job.delivery)
    val destination = DesignStorage.file(context, version, job.path)
    if (destination.parentFile?.isDirectory != true) throw StorageFailure()
    if (verify(destination, job)) return "verified"
    val partial = DesignStorage.partial(context, job.scope, job.delivery, job.index)
    if (partial.parentFile?.isDirectory != true) throw StorageFailure()
    var offset = if (partial.exists()) partial.length() else 0L
    if (partial.exists() && offset >= job.size) {
      if (verify(partial, job)) {
        if (job.isStopped()) return "retry"
        commit(partial, destination)
        return "verified"
      }
      remove(partial)
      offset = 0L
    }

    val url = job.url.toHttpUrlOrNull()
    if (url == null || url.scheme != "https") return "permanent"
    val request = Request.Builder().url(url).get()
      // Byte-exact ranges and hashes need the body exactly as stored, never re-encoded.
      .header("Accept-Encoding", "identity")
    if (offset > 0) request.header("Range", "bytes=$offset-")
    client.newCall(request.build()).execute().use { response ->
      if (job.isStopped()) return "retry"
      val status = response.code
      if (status == 401 || status == 403) return "expired"
      if (status == 416) {
        remove(partial)
        return if (offset > 0) "retry" else "permanent"
      }
      when (status) {
        206 -> if (!isExpectedRange(response.header("Content-Range"), offset, job.size)) return "permanent"
        200 -> offset = 0L
        else -> return if (status == 408 || status == 429 || status >= 500) "retry" else "permanent"
      }
      val body = response.body ?: return "retry"
      val written = write(body.byteStream(), partial, offset, job) ?: return "checksum"
      offset = written
    }
    if (job.isStopped() || offset < job.size) return "retry"
    if (!verify(partial, job)) {
      remove(partial)
      return "checksum"
    }
    if (job.isStopped()) return "retry"
    commit(partial, destination)
    return "verified"
  }

  /** Appends (or restarts) the partial; returns the new length, or null when the body is oversized. */
  private fun write(input: InputStream, partial: File, start: Long, job: DesignJob): Long? {
    var offset = start
    val output = try {
      FileOutputStream(partial, offset > 0)
    } catch (error: IOException) {
      throw StorageFailure()
    }
    output.use {
      val buffer = ByteArray(CHUNK_SIZE)
      while (!job.isStopped()) {
        val received = input.read(buffer) // Network failures propagate as "retry".
        if (job.isStopped() || received < 0) break
        if (received > job.size - offset) {
          output.close()
          remove(partial)
          return null
        }
        storage { output.write(buffer, 0, received) }
        offset += received
      }
    }
    return offset
  }

  private fun isExpectedRange(header: String?, offset: Long, size: Long): Boolean {
    val match = header?.let { CONTENT_RANGE.matchEntire(it.trim()) } ?: return false
    return match.groupValues[1].toLongOrNull() == offset && match.groupValues[3].toLongOrNull() == size
  }

  private fun verify(file: File, job: DesignJob): Boolean {
    if (!file.isFile || file.length() != job.size) return false
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(CHUNK_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    val hash = digest.digest().joinToString("") { "%02x".format(it) }
    return hash == job.sha256
  }

  /** Flushes the verified partial to disk, then renames it over the destination. */
  private fun commit(partial: File, destination: File) {
    FileOutputStream(partial, true).use { it.fd.sync() }
    DesignStorage.replace(context, partial, destination)
  }

  private fun remove(file: File) {
    if (file.exists() && !file.delete()) throw StorageFailure()
  }

  private inline fun storage(action: () -> Unit) {
    try {
      action()
    } catch (error: IOException) {
      throw StorageFailure()
    }
  }

  private companion object {
    const val CHUNK_SIZE = 65_536
    val CONTENT_RANGE = Regex("bytes (\\d+)-(\\d+)/(\\d+)", RegexOption.IGNORE_CASE)
  }
}

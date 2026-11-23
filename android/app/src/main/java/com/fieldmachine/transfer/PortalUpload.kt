package com.fieldmachine.transfer

import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source

/** Result handed back to JS as { status, body }, matching the Windows module. */
data class UploadResponse(val status: Int, val body: String)

/**
 * Android counterpart of windows/FieldMachine/Native/PortalTransferUpload.cpp:
 * the same multipart form (transferId + file), bearer token, no redirects,
 * a 5-minute limit, and progress capped at 99% until the response arrives.
 */
object PortalUpload {
  private const val CHUNK_SIZE = 65_536L

  private val client: OkHttpClient =
    OkHttpClient.Builder()
      .followRedirects(false)
      .followSslRedirects(false)
      .callTimeout(5, TimeUnit.MINUTES)
      .build()

  /** Throws IllegalArgumentException for invalid input (reported as status 400). */
  fun send(
    url: String,
    token: String,
    id: String,
    file: File,
    onProgress: (percent: Int) -> Unit,
  ): UploadResponse {
    val httpUrl = url.toHttpUrlOrNull()
    require(httpUrl != null && httpUrl.scheme == "https" && httpUrl.encodedPath.endsWith("/mc/device/files")) {
      "Invalid transfer endpoint."
    }
    require(file.length() <= TransferStorage.MAX_PORTAL_FILE_SIZE) { "Staged file exceeds the size limit." }
    val mimeType = requireNotNull(TransferStorage.mimeTypeFor(file.name)) { "Unsupported file extension." }

    val form =
      MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart("transferId", id)
        // addFormDataPart quotes the name and accepts non-ASCII file names;
        // a hand-built Headers value would reject them.
        .addFormDataPart("file", file.name, ProgressFileBody(file, mimeType.toMediaType(), onProgress))
        .build()
    val request =
      Request.Builder().url(httpUrl).header("Authorization", "Bearer $token").post(form).build()
    client.newCall(request).execute().use { response ->
      return UploadResponse(response.code, response.body?.string() ?: "")
    }
  }

  /** Streams the file and reports whole-percent progress, never above 99. */
  private class ProgressFileBody(
    private val file: File,
    private val mediaType: MediaType,
    private val onProgress: (Int) -> Unit,
  ) : RequestBody() {
    override fun contentType(): MediaType = mediaType

    override fun contentLength(): Long = file.length()

    override fun writeTo(sink: BufferedSink) {
      val total = file.length()
      var sent = 0L
      var lastPercent = -1
      file.source().use { source ->
        while (true) {
          val read = source.read(sink.buffer, CHUNK_SIZE)
          if (read == -1L) break
          sink.flush()
          sent += read
          val percent = if (total == 0L) 99 else minOf(99L, sent * 100 / total).toInt()
          if (percent > lastPercent) {
            lastPercent = percent
            onProgress(percent)
          }
        }
      }
    }
  }
}

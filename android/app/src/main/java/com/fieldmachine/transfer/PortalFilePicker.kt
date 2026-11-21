package com.fieldmachine.transfer

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import java.io.File

/**
 * Wraps the Storage Access Framework picker for PortalTransferModule:
 * builds the intent, validates the picked files (type and 20 MiB limit),
 * remembers them until stage(), and copies one into the queue.
 */
class PortalFilePicker(private val context: Context) {
  private data class Picked(val uri: Uri, val name: String)

  @Volatile private var selection: List<Picked> = emptyList()

  fun createIntent(): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, TransferStorage.pickerMimeTypes)
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
    }

  /** Resolves with the picked file names; an empty list means the operator cancelled. */
  fun finish(resultCode: Int, data: Intent?, promise: Promise) {
    try {
      selection = emptyList()
      val names = Arguments.createArray()
      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(names)
        return
      }
      val picked = pickedUris(data).map { uri -> describe(uri) }
      if (picked.any { it == null }) {
        promise.reject(ERROR_CODE, "Each file must be 20 MiB or smaller. Choose the files again.")
        return
      }
      val valid = picked.filterNotNull()
      if (valid.any { TransferStorage.mimeTypeFor(it.name) == null }) {
        promise.reject(ERROR_CODE, "Choose PDF, DOC, DOCX, JPG, PNG, or HEIC files.")
        return
      }
      selection = valid
      valid.forEach { names.pushString(it.name) }
      promise.resolve(names)
    } catch (error: Exception) {
      promise.reject(ERROR_CODE, "Could not open or read the selected files.", error)
    }
  }

  /** Hands over the current selection once, like the Windows std::exchange. */
  fun takeSelection(): List<Uri> {
    val taken = selection.map { it.uri }
    selection = emptyList()
    return taken
  }

  /** Copies into queue/.id, then renames to queue/id so half-copied files are never listed. */
  fun copyIntoQueue(uri: Uri, queue: File, id: String) {
    val name = TransferStorage.safeFileName(displayName(uri))
    val draft = TransferStorage.contained(TransferStorage.appRoot(context), File(queue, ".$id"))
    check(draft.mkdir()) { "Transfer draft already exists." }
    try {
      val target = File(draft, name)
      val input = checkNotNull(context.contentResolver.openInputStream(uri)) { "Cannot open file." }
      input.use { source ->
        target.outputStream().use { output ->
          val buffer = ByteArray(65_536)
          var total = 0L
          while (true) {
            val read = source.read(buffer)
            if (read < 0) break
            total += read
            require(total <= TransferStorage.MAX_PORTAL_FILE_SIZE) { "Selected file exceeds the size limit." }
            output.write(buffer, 0, read)
          }
          output.fd.sync()
        }
      }
      check(draft.renameTo(File(queue, id))) { "Could not finish staging." }
    } catch (error: Exception) {
      draft.deleteRecursively()
      throw error
    }
  }

  private fun pickedUris(data: Intent): List<Uri> {
    val clip = data.clipData
    if (clip != null) return (0 until clip.itemCount).map { clip.getItemAt(it).uri }
    return listOfNotNull(data.data)
  }

  /** Returns null when the file is larger than the limit. */
  private fun describe(uri: Uri): Picked? {
    var size = -1L
    context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) size = cursor.getLong(0)
    }
    if (size > TransferStorage.MAX_PORTAL_FILE_SIZE) return null
    return Picked(uri, TransferStorage.safeFileName(displayName(uri)))
  }

  private fun displayName(uri: Uri): String {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getString(0)
    }
    return uri.lastPathSegment ?: ""
  }

  private companion object {
    const val ERROR_CODE = "E_PORTAL_TRANSFER"
  }
}

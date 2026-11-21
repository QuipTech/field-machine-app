package com.fieldmachine.transfer

import android.content.Context
import java.io.File
import java.util.Locale

/**
 * Android counterpart of windows/FieldMachine/Native/PortalTransferStorage.h.
 * Everything lives under the app-private files directory. Every resolved path
 * is checked with getCanonicalPath so symlinks or "../" can never escape it
 * (java.nio symlink checks need API 26; minSdk is 24).
 */
object TransferStorage {
  const val MAX_PORTAL_FILE_SIZE = 20_971_520L

  private val PAIRING_PATTERN = Regex("[a-z0-9-]+_[0-9a-fA-F-]{36}_[0-9a-fA-F-]{36}")
  private val TRANSFER_ID_PATTERN =
    Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

  private val MIME_TYPES =
    mapOf(
      "pdf" to "application/pdf",
      "doc" to "application/msword",
      "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "jpg" to "image/jpeg",
      "jpeg" to "image/jpeg",
      "png" to "image/png",
      "heic" to "image/heic",
    )

  val pickerMimeTypes: Array<String> = MIME_TYPES.values.distinct().toTypedArray()

  fun isTransferId(id: String): Boolean = TRANSFER_ID_PATTERN.matches(id)

  /** Returns the MIME type for an allowed extension, or null when not allowed. */
  fun mimeTypeFor(fileName: String): String? =
    MIME_TYPES[fileName.substringAfterLast('.', "").lowercase(Locale.ROOT)]

  fun appRoot(context: Context): File = File(context.filesDir, "FIELD Machine")

  fun portalQueue(context: Context, pairing: String): File {
    require(PAIRING_PATTERN.matches(pairing)) { "Invalid transfer pairing." }
    return contained(appRoot(context), File(File(appRoot(context), "Portal transfers"), pairing))
  }

  fun pendingTransfer(context: Context, pairing: String, id: String): File {
    require(isTransferId(id)) { "Invalid transfer ID." }
    return contained(appRoot(context), File(portalQueue(context, pairing), id))
  }

  fun stagedFile(context: Context, directory: File): File {
    contained(appRoot(context), directory)
    require(directory.isDirectory) { "Missing staged transfer." }
    val file = directory.listFiles()?.firstOrNull { it.isFile }
    requireNotNull(file) { "Missing staged file." }
    return contained(appRoot(context), file)
  }

  /** Keeps only a safe single file name from a picker display name. */
  fun safeFileName(displayName: String): String {
    val name = displayName.substringAfterLast('/').filter { it >= ' ' && it !in "<>:\"\\|?*" }.trim()
    require(name.isNotEmpty() && name != "." && name != "..") { "Invalid file name." }
    return name
  }

  /** Throws unless [file] resolves inside [root] after following links. */
  fun contained(root: File, file: File): File {
    val rootPath = root.canonicalPath + File.separator
    val filePath = file.canonicalPath
    require(filePath.startsWith(rootPath)) { "Transfer storage contains a redirected path." }
    return file
  }
}

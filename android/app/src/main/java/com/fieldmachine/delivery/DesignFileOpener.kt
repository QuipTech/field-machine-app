package com.fieldmachine.delivery

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File
import java.util.Locale

/**
 * Lets the operator open a received design file in another app ("Open with").
 * Files stay in app-private storage; FileProvider hands the chosen app a
 * temporary, read-only content:// URI for that single file.
 */
object DesignFileOpener {
  private const val AUTHORITY_SUFFIX = ".designfiles"

  /** Relative "/"-separated paths of every file in a delivered project version. */
  fun list(version: File): List<String> {
    if (!version.isDirectory) return emptyList()
    val prefix = version.canonicalPath + File.separator
    return version.walkTopDown()
      .filter { it.isFile }
      .map { it.canonicalPath.removePrefix(prefix).replace(File.separatorChar, '/') }
      .sorted()
      .toList()
  }

  /** Throws ActivityNotFoundException when no installed app can open the file. */
  fun open(activity: Activity, file: File) {
    require(file.isFile) { "Missing design file." }
    val uri = FileProvider.getUriForFile(activity, activity.packageName + AUTHORITY_SUFFIX, file)
    val view =
      Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeTypeFor(file))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    if (view.resolveActivity(activity.packageManager) == null) {
      throw ActivityNotFoundException("No app can open this file.")
    }
    activity.startActivity(Intent.createChooser(view, "Open with"))
  }

  /** Design formats (DXF, LandXML, …) are often unknown to Android; let any app offer to open them. */
  private fun mimeTypeFor(file: File): String {
    val extension = file.extension.lowercase(Locale.ROOT)
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "*/*"
  }
}

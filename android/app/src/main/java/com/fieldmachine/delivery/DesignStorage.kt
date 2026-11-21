package com.fieldmachine.delivery

import android.content.Context
import com.fieldmachine.transfer.TransferStorage
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

/**
 * Android counterpart of windows/FieldMachine/Native/DesignDeliveryStorage.h.
 * Deliveries live in app-managed storage beside the Portal transfer queue:
 * <files>/FIELD Machine/Portal transfers/<scope>/Design delivery/<project>/<delivery>/.
 * File-name rules match Windows so a project can later be copied to a Windows tablet.
 */
object DesignStorage {
  private const val EMPTY_JOURNAL = """{"projects":[],"pending":null}"""
  private const val INVALID_CHARACTERS = "<>:\"\\|?*"
  private val RESERVED_NAMES = setOf("CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$")
  private const val RESERVED_DIGITS = "123456789¹²³"

  fun root(context: Context, scope: String): File {
    val root = contained(context, File(TransferStorage.portalQueue(context, scope), "Design delivery"))
    root.mkdirs()
    return root
  }

  fun child(context: Context, parent: File, id: String): File {
    require(TransferStorage.isTransferId(id)) { "Invalid design identifier." }
    return contained(context, File(parent, id))
  }

  fun version(context: Context, scope: String, project: String, delivery: String): File =
    child(context, child(context, root(context, scope), project), delivery)

  /** Resolves a "/"-separated relative path inside [directory], creating parent folders. */
  fun file(context: Context, directory: File, relative: String): File {
    var current = directory
    val segments = relative.split('/')
    segments.forEachIndexed { index, segment ->
      requireValidSegment(segment)
      current = contained(context, File(current, segment))
      if (index < segments.lastIndex) current.mkdir()
    }
    return current
  }

  fun partial(context: Context, scope: String, delivery: String, index: Long): File {
    val partials = child(context, File(root(context, scope), "partials"), delivery)
    partials.mkdirs()
    return contained(context, File(partials, "$index.part"))
  }

  fun readJournal(context: Context, scope: String): String {
    val path = contained(context, File(root(context, scope), "journal.json"))
    return if (path.exists()) path.readText(Charsets.UTF_8) else EMPTY_JOURNAL
  }

  /** Writes to journal.tmp, syncs to disk, then renames over journal.json atomically. */
  fun writeJournal(context: Context, scope: String, payload: String) {
    val root = root(context, scope)
    val temporary = contained(context, File(root, "journal.tmp"))
    FileOutputStream(temporary).use { output ->
      output.write(payload.toByteArray(Charsets.UTF_8))
      output.fd.sync()
    }
    replace(context, temporary, File(root, "journal.json"))
  }

  /** Atomic same-directory replace (rename(2) overwrites the destination on Linux). */
  fun replace(context: Context, from: File, to: File) {
    contained(context, from)
    contained(context, to)
    check(from.renameTo(to)) { "Could not replace design file." }
  }

  private fun requireValidSegment(segment: String) {
    require(
      segment.isNotEmpty() && segment != "." && segment != ".." &&
        !segment.endsWith('.') && !segment.endsWith(' ') &&
        segment.none { it < ' ' || it in INVALID_CHARACTERS },
    ) { "Invalid design file name." }
    val stem = segment.substringBefore('.').trimEnd().uppercase(Locale.ROOT)
    val isDeviceName =
      stem.length == 4 && (stem.startsWith("COM") || stem.startsWith("LPT")) && stem.last() in RESERVED_DIGITS
    require(stem !in RESERVED_NAMES && !isDeviceName) { "Reserved design file name." }
  }

  private fun contained(context: Context, file: File): File =
    TransferStorage.contained(TransferStorage.appRoot(context), file)
}

package com.fieldmachine.transfer

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Android counterpart of windows/FieldMachine/Native/PortalTransferModule.*.
 * Same JS name, methods, and messages. pick() opens the system document picker
 * (any file on the tablet the operator can browse to); stage() copies the
 * picked files into the app-private queue, so uploads survive restarts.
 */
class PortalTransferModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val worker = Executors.newSingleThreadExecutor()
  private val picker = PortalFilePicker(context)
  private var pickPromise: Promise? = null

  private val activityListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PICK_REQUEST_CODE) return
        val promise = pickPromise ?: return
        pickPromise = null
        worker.execute { picker.finish(resultCode, data, promise) }
      }
    }

  init {
    context.addActivityEventListener(activityListener)
  }

  override fun getName(): String = NAME

  /** Runs on the UI thread, like Windows, so pickPromise is only touched there and in onActivityResult. */
  @ReactMethod
  fun pick(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = context.currentActivity
      if (pickPromise != null) {
        promise.reject(ERROR_CODE, "A file picker is already open.")
        return@runOnUiThread
      }
      if (activity == null) {
        promise.reject(ERROR_CODE, "Could not open or read the selected files.")
        return@runOnUiThread
      }
      pickPromise = promise
      try {
        activity.startActivityForResult(picker.createIntent(), PICK_REQUEST_CODE)
      } catch (error: Exception) {
        pickPromise = null
        promise.reject(ERROR_CODE, "Could not open or read the selected files.", error)
      }
    }
  }

  @ReactMethod
  fun stage(pairing: String, promise: Promise) {
    val selection: List<Uri> = picker.takeSelection()
    worker.execute {
      try {
        val queue = TransferStorage.portalQueue(context, pairing)
        queue.mkdirs()
        selection.forEach { uri -> picker.copyIntoQueue(uri, queue, UUID.randomUUID().toString()) }
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not save every selected file. Check the queue and select any missing files again.", error)
      }
    }
  }

  @ReactMethod
  fun list(pairing: String, promise: Promise) {
    worker.execute {
      try {
        val entries = Arguments.createArray()
        val queue = TransferStorage.portalQueue(context, pairing)
        queue.listFiles()
          ?.filter { TransferStorage.isTransferId(it.name) && it.isDirectory && !it.list().isNullOrEmpty() }
          ?.forEach { folder ->
            val file = TransferStorage.stagedFile(context, folder)
            entries.pushMap(Arguments.createMap().apply {
              putString("id", folder.name)
              putString("fileName", file.name)
            })
          }
        promise.resolve(entries)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not read the pending transfer queue.", error)
      }
    }
  }

  @ReactMethod
  fun remove(pairing: String, id: String, promise: Promise) {
    worker.execute {
      try {
        TransferStorage.pendingTransfer(context, pairing, id).deleteRecursively()
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, error.message ?: "Could not remove the transfer.", error)
      }
    }
  }

  @ReactMethod
  fun upload(url: String, token: String, pairing: String, id: String, promise: Promise) {
    worker.execute {
      try {
        val file = TransferStorage.stagedFile(context, TransferStorage.pendingTransfer(context, pairing, id))
        val response = PortalUpload.send(url, token, id, file) { percent -> emitProgress(id, percent) }
        promise.resolve(responseMap(response.status, response.body))
      } catch (error: IllegalArgumentException) {
        promise.resolve(responseMap(400, ""))
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "The upload could not reach the Portal.", error)
      }
    }
  }

  private fun emitProgress(id: String, percent: Int) {
    val event = Arguments.createMap().apply {
      putString("id", id)
      putInt("percent", percent)
    }
    context.emitDeviceEvent("fieldPortalUploadProgress", event)
  }

  private fun responseMap(status: Int, body: String) =
    Arguments.createMap().apply {
      putInt("status", status)
      putString("body", body)
    }

  companion object {
    const val NAME = "FieldMachinePortalTransfer"
    private const val PICK_REQUEST_CODE = 41_870
    private const val ERROR_CODE = "E_PORTAL_TRANSFER"
  }
}

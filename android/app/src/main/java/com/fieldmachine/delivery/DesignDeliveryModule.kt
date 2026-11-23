package com.fieldmachine.delivery

import android.content.ActivityNotFoundException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/**
 * Android counterpart of windows/FieldMachine/Native/DesignDeliveryModule.*.
 * Same JS name, methods, result words, and messages. Journal work runs on one
 * ordered worker; downloads run on their own pool so a long file never blocks
 * a journal read. stop() bumps a generation counter that aborts in-flight work.
 */
class DesignDeliveryModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val journalWorker = Executors.newSingleThreadExecutor()
  private val downloadWorker = Executors.newCachedThreadPool()
  private val generation = AtomicLong(0)
  private val downloader = DesignDownload(context, generation)

  override fun getName(): String = NAME

  @ReactMethod
  fun readJournal(scope: String, promise: Promise) {
    journalWorker.execute {
      try {
        promise.resolve(DesignStorage.readJournal(context, scope))
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not read saved design deliveries.", error)
      }
    }
  }

  @ReactMethod
  fun writeJournal(scope: String, payload: String, promise: Promise) {
    journalWorker.execute {
      try {
        DesignStorage.writeJournal(context, scope, payload)
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not save design delivery state.", error)
      }
    }
  }

  @ReactMethod
  fun prepare(scope: String, delivery: String, project: String, promise: Promise) {
    journalWorker.execute {
      try {
        val version = DesignStorage.version(context, scope, project, delivery)
        check(version.isDirectory || version.mkdirs()) { "Could not create the project directory." }
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not prepare the project directory.", error)
      }
    }
  }

  @ReactMethod
  fun download(
    scope: String,
    delivery: String,
    project: String,
    path: String,
    index: Double,
    size: Double,
    sha256: String,
    url: String,
    promise: Promise,
  ) {
    if (index !in 0.0..MAX_SAFE_INTEGER || size !in 0.0..MAX_SAFE_INTEGER) {
      promise.resolve("permanent")
      return
    }
    val job = DesignJob(scope, delivery, project, path, index.toLong(), size.toLong(), sha256, url, generation.get())
    downloadWorker.execute { promise.resolve(downloader.run(job)) }
  }

  @ReactMethod
  fun stop() {
    generation.incrementAndGet()
    downloader.cancelAll()
  }

  /** Android has no system viewer for app-private folders, so this always rejects. */
  @ReactMethod
  fun openProject(scope: String, delivery: String, project: String, promise: Promise) {
    promise.reject(ERROR_CODE, "Opening project folders is not available on Android.")
  }

  /** Android only: lists a project's files so each can be opened in another app. */
  @ReactMethod
  fun listFiles(scope: String, delivery: String, project: String, promise: Promise) {
    journalWorker.execute {
      try {
        val files = Arguments.createArray()
        DesignFileOpener.list(DesignStorage.version(context, scope, project, delivery)).forEach(files::pushString)
        promise.resolve(files)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not list the project files.", error)
      }
    }
  }

  /** Android only: shows the system "Open with" chooser for one delivered file. */
  @ReactMethod
  fun openFile(scope: String, delivery: String, project: String, path: String, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject(ERROR_CODE, "Could not open the file.")
      return
    }
    activity.runOnUiThread {
      try {
        val version = DesignStorage.version(context, scope, project, delivery)
        DesignFileOpener.open(activity, DesignStorage.file(context, version, path))
        promise.resolve(null)
      } catch (error: ActivityNotFoundException) {
        promise.reject(ERROR_CODE, "No app on this tablet can open this file.", error)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, "Could not open the file.", error)
      }
    }
  }

  override fun invalidate() {
    stop()
    journalWorker.shutdown()
    downloadWorker.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "FieldMachineDesignDelivery"
    private const val ERROR_CODE = "E_DESIGN_DELIVERY"
    private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991.0
  }
}

package com.fieldmachine.remote

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Keeps an active remote session alive while the app is minimised and shows the
 * floating marker. React Native pauses JavaScript timers in the background,
 * which stops the session heartbeat; a running headless task keeps them going.
 */
class RemoteSessionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val main = Handler(Looper.getMainLooper())

  // Only touched on the main thread.
  private var taskId: Int? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun start() {
    main.post {
      finish()
      val config = HeadlessJsTaskConfig(TASK_NAME, Arguments.createMap(), 0, true)
      taskId = HeadlessJsTaskContext.getInstance(reactApplicationContext).startTask(config)
      // Without the accessibility service there is no marker (and no control).
      RemoteInputService.current?.bubble?.show { emitEnd() }
    }
  }

  @ReactMethod
  fun stop() {
    main.post { finish() }
  }

  override fun invalidate() {
    main.post { finish() }
    super.invalidate()
  }

  private fun finish() {
    RemoteInputService.current?.bubble?.hide()
    val tasks = HeadlessJsTaskContext.getInstance(reactApplicationContext)
    taskId?.let { if (tasks.isTaskRunning(it)) tasks.finishTask(it) }
    taskId = null
  }

  private fun emitEnd() {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(END_EVENT, null)
  }

  companion object {
    const val NAME = "FieldMachineRemoteSession"
    private const val TASK_NAME = "FieldRemoteSession"
    private const val END_EVENT = "fieldRemoteSessionEnd"
  }
}

package com.fieldmachine.remote

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Android counterpart of windows/FieldMachine/Native/RemoteDesktopInput.h.
 * Same JS name and start/reset/apply surface, so src/native/remoteDesktopInput.ts
 * works on both platforms. Input is applied only for the current owner (one
 * consented session peer) through RemoteInputService. Never log input values.
 */
class RemoteDesktopInputModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val main = Handler(Looper.getMainLooper())

  // Only touched on the main thread.
  private var owner: String? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun start(nextOwner: String, promise: Promise) {
    main.post {
      releaseInput()
      val service = RemoteInputService.current
      // Continued strokes, needed for drags and long presses, require API 26.
      val isReady = nextOwner.isNotEmpty() && service != null &&
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      owner = if (isReady) nextOwner else null
      promise.resolve(isReady)
    }
  }

  @ReactMethod
  fun reset(currentOwner: String, end: Boolean) {
    main.post {
      if (currentOwner != owner) return@post
      releaseInput()
      if (end) owner = null
    }
  }

  @ReactMethod
  fun apply(
    currentOwner: String, kind: String, action: String, x: Double, y: Double,
    first: Double, second: Double, value: String, promise: Promise,
  ) {
    main.post {
      val service = RemoteInputService.current
      if (owner == null || currentOwner != owner || service == null) {
        promise.resolve(false)
        return@post
      }
      promise.resolve(applyInput(service, kind, action, x, y, first, second, value))
    }
  }

  /** True when the operator has enabled the FIELD Machine accessibility service. */
  @ReactMethod
  fun isServiceEnabled(promise: Promise) {
    promise.resolve(RemoteInputService.current != null)
  }

  /** Opens Settings > Accessibility so the operator can enable the service. */
  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }

  override fun invalidate() {
    main.post {
      releaseInput()
      owner = null
    }
    super.invalidate()
  }

  private fun applyInput(
    service: RemoteInputService, kind: String, action: String, x: Double, y: Double,
    first: Double, second: Double, value: String,
  ): Boolean {
    val isPoint = x in 0.0..1.0 && y in 0.0..1.0
    return when (kind) {
      "pointer" -> isPoint && first in 0.0..2.0 &&
        service.gestures.pointer(action, first.toInt(), x, y)
      "wheel" -> isPoint && Math.abs(first) <= MAX_WHEEL && Math.abs(second) <= MAX_WHEEL &&
        service.gestures.wheel(x, y, first, second)
      "key" -> (action == "down" || action == "up") && value.length in 1..32 &&
        service.text.key(action, value)
      "text" -> value.length in 1..MAX_TEXT && service.text.text(value)
      else -> false
    }
  }

  private fun releaseInput() {
    RemoteInputService.current?.release()
  }

  companion object {
    const val NAME = "FieldMachineRemoteDesktopInput"
    private const val MAX_WHEEL = 2400.0
    private const val MAX_TEXT = 2048
  }
}

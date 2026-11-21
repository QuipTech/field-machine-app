package com.fieldmachine.remote

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * Accessibility service that injects Portal remote-control input while a
 * consented remote support session is active. It does nothing on its own:
 * RemoteDesktopInputModule only forwards input after the operator accepted
 * control and the JS owner check passed. The operator enables it once per
 * tablet in Settings > Accessibility.
 */
class RemoteInputService : AccessibilityService() {

  internal val gestures = RemoteGestures(this)
  internal val text = RemoteTextInput(this)

  override fun onServiceConnected() {
    super.onServiceConnected()
    current = this
  }

  // Input is driven only by the module; window events are not needed.
  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

  override fun onInterrupt() {
    release()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    disconnect()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    disconnect()
    super.onDestroy()
  }

  /** Lifts any held touch and forgets held modifier keys. */
  internal fun release() {
    gestures.release()
    text.release()
  }

  private fun disconnect() {
    release()
    if (current === this) current = null
  }

  companion object {
    /** The connected service, or null when the operator has not enabled it. */
    @Volatile
    internal var current: RemoteInputService? = null
      private set
  }
}

package com.fieldmachine.remote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.accessibilityservice.GestureDescription.StrokeDescription
import android.graphics.Path
import android.graphics.PointF
import android.hardware.display.DisplayManager
import android.util.DisplayMetrics
import android.view.Display

/**
 * Turns protocol v1 pointer and wheel messages into dispatched touch gestures.
 * A primary-button press becomes one continued stroke (down, moves, up), so
 * taps, drags and long presses behave like a finger. A gesture must finish
 * before it can be continued, so moves that arrive meanwhile are queued and
 * sent as one segment. All methods run on the main thread.
 */
class RemoteGestures(private val service: AccessibilityService) {

  private var stroke: StrokeDescription? = null
  private var last: PointF? = null
  private val pending = mutableListOf<PointF>()
  private var isEnding = false
  private var isInFlight = false
  private var isScrolling = false
  // Ignores callbacks from gestures that a newer gesture replaced.
  private var generation = 0

  fun pointer(action: String, button: Int, x: Double, y: Double): Boolean {
    val point = toScreen(x, y)
    // A secondary click becomes a long press, Android's context-menu gesture.
    if (button == SECONDARY_BUTTON) return action != "up" || longPress(point)
    if (button != PRIMARY_BUTTON) return false
    return when (action) {
      "down" -> down(point)
      "move" -> queue(point, false)
      "up" -> queue(point, true)
      "cancel" -> queue(last ?: point, true)
      else -> false
    }
  }

  fun wheel(x: Double, y: Double, deltaX: Double, deltaY: Double): Boolean {
    if (stroke != null || isScrolling) return false
    val size = screenSize()
    val start = toScreen(x, y)
    // Wheel deltas are pixels; moving content down means the finger moves up.
    val end = PointF(
      (start.x - deltaX.toFloat()).coerceIn(1f, size.x - 2f),
      (start.y - deltaY.toFloat()).coerceIn(1f, size.y - 2f),
    )
    if (Math.abs(end.x - start.x) < 2f && Math.abs(end.y - start.y) < 2f) return true
    val path = Path().apply { moveTo(start.x, start.y); lineTo(end.x, end.y) }
    // Hold at the end before lifting so the swipe scrolls without a fling.
    val swipe = StrokeDescription(path, 0, SCROLL_MS, true)
    val gesture = ++generation
    isScrolling = true
    return dispatch(swipe, gesture) {
      dispatch(swipe.continueStroke(pathAt(end), 0, HOLD_MS, false), gesture) {
        isScrolling = false
      }
    }
  }

  /** Lifts a held touch, for example when the session ends mid-drag. */
  fun release() {
    pending.clear()
    if (stroke == null) return
    isEnding = true
    flush()
  }

  private fun down(point: PointF): Boolean {
    // A new gesture cancels anything still running, so drop the old state.
    pending.clear()
    isEnding = false
    isScrolling = false
    last = point
    val first = StrokeDescription(pathAt(point), 0, 1, true)
    stroke = first
    isInFlight = true
    return dispatch(first, ++generation) { onSegmentDone() }
  }

  private fun queue(point: PointF, isFinal: Boolean): Boolean {
    // Hover moves without a pressed button have no touch equivalent.
    if (stroke == null) return true
    if (pending.size >= MAX_PENDING) pending.removeAt(0)
    pending.add(point)
    if (isFinal) isEnding = true
    flush()
    return true
  }

  private fun flush() {
    val current = stroke ?: return
    val from = last ?: return
    if (isInFlight || (pending.isEmpty() && !isEnding)) return
    val path = Path().apply {
      moveTo(from.x, from.y)
      pending.forEach { lineTo(it.x, it.y) }
    }
    val duration = (pending.size * FRAME_MS).coerceIn(1L, MAX_SEGMENT_MS)
    last = pending.lastOrNull() ?: from
    pending.clear()
    val next = current.continueStroke(path, 0, duration, !isEnding)
    stroke = next
    isInFlight = true
    dispatch(next, generation) { onSegmentDone() }
  }

  private fun onSegmentDone() {
    isInFlight = false
    if (stroke?.willContinue() == false) {
      stroke = null
      last = null
      isEnding = false
      return
    }
    flush()
  }

  private fun longPress(point: PointF): Boolean {
    if (stroke != null) return false
    return dispatch(StrokeDescription(pathAt(point), 0, LONG_PRESS_MS), ++generation) {}
  }

  private fun dispatch(next: StrokeDescription, gesture: Int, onDone: () -> Unit): Boolean {
    val description = GestureDescription.Builder().addStroke(next).build()
    val callback = object : AccessibilityService.GestureResultCallback() {
      override fun onCompleted(done: GestureDescription?) {
        if (gesture == generation) onDone()
      }

      override fun onCancelled(done: GestureDescription?) {
        if (gesture != generation) return
        // Android cancelled the touch (for example a system gesture took over).
        stroke = null
        last = null
        pending.clear()
        isEnding = false
        isInFlight = false
        isScrolling = false
      }
    }
    val isAccepted = service.dispatchGesture(description, callback, null)
    if (!isAccepted && gesture == generation) callback.onCancelled(description)
    return isAccepted
  }

  private fun pathAt(point: PointF) = Path().apply { moveTo(point.x, point.y) }

  private fun toScreen(x: Double, y: Double): PointF {
    val size = screenSize()
    return PointF((x * (size.x - 1)).toFloat(), (y * (size.y - 1)).toFloat())
  }

  // Same real display metrics react-native-webrtc uses for the captured frame,
  // so normalized Portal coordinates line up with the shared video.
  @Suppress("DEPRECATION")
  private fun screenSize(): PointF {
    val manager = service.getSystemService(DisplayManager::class.java)
    val metrics = DisplayMetrics()
    manager.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
    return PointF(metrics.widthPixels.toFloat(), metrics.heightPixels.toFloat())
  }

  private companion object {
    const val PRIMARY_BUTTON = 0
    const val SECONDARY_BUTTON = 2
    const val MAX_PENDING = 64
    const val FRAME_MS = 16L
    const val MAX_SEGMENT_MS = 250L
    const val SCROLL_MS = 200L
    const val HOLD_MS = 80L
    const val LONG_PRESS_MS = 700L
  }
}

package com.fieldmachine.remote

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Floating "remote session" marker shown over every app while a session is
 * active, so the operator always knows the tablet is shared and can return to
 * FIELD Machine or end the session. An accessibility overlay needs no extra
 * permission. Call only on the main thread.
 */
class RemoteSessionBubble(private val service: AccessibilityService) {

  private val windows get() = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null

  fun show(onEnd: () -> Unit) {
    hide()
    val layout = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }
    val actions = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      visibility = View.GONE
      addView(button("Open FIELD Machine") { openApp() })
      addView(button("End session") { onEnd() })
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.END or Gravity.CENTER_VERTICAL }
    layout.addView(marker(layout, params) {
      actions.visibility = if (actions.visibility == View.GONE) View.VISIBLE else View.GONE
    })
    layout.addView(actions)
    windows.addView(layout, params)
    root = layout
  }

  fun hide() {
    root?.let { windows.removeView(it) }
    root = null
  }

  // Tap opens the actions; dragging moves the marker out of the way.
  private fun marker(layout: View, params: WindowManager.LayoutParams, onTap: () -> Unit): TextView {
    val size = dp(64)
    var startY = 0f
    var originY = 0
    var isDragging = false
    return TextView(service).apply {
      text = "REMOTE"
      textSize = 11f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      contentDescription = "Remote session active"
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.rgb(180, 35, 24))
        setStroke(dp(2), Color.WHITE)
      }
      layoutParams = LinearLayout.LayoutParams(size, size)
      setOnClickListener { onTap() }
      setOnTouchListener { view, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            startY = event.rawY
            originY = params.y
            isDragging = false
          }
          MotionEvent.ACTION_MOVE -> {
            val moved = event.rawY - startY
            if (isDragging || Math.abs(moved) > dp(8)) {
              isDragging = true
              params.y = originY + moved.toInt()
              windows.updateViewLayout(layout, params)
            }
          }
          MotionEvent.ACTION_UP -> if (!isDragging) view.performClick()
        }
        true
      }
    }
  }

  private fun button(label: String, onPress: () -> Unit) = Button(service).apply {
    text = label
    isAllCaps = false
    setOnClickListener { onPress() }
  }

  private fun openApp() {
    val intent = service.packageManager.getLaunchIntentForPackage(service.packageName) ?: return
    service.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  private fun dp(value: Int) = (value * service.resources.displayMetrics.density).toInt()
}

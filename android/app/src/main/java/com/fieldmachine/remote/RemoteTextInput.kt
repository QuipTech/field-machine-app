package com.fieldmachine.remote

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction

/**
 * Applies protocol v1 text and key messages to the focused input field.
 * Android does not let apps inject arbitrary key codes, so editing keys are
 * emulated with accessibility actions on the focused node and printable
 * keys are inserted as text. Escape maps to Back. All methods run on the
 * main thread.
 */
class RemoteTextInput(private val service: AccessibilityService) {

  private val heldModifiers = mutableSetOf<String>()

  fun text(value: String): Boolean = insert(value)

  fun key(action: String, code: String): Boolean {
    if (code in MODIFIERS) {
      if (action == "down") heldModifiers.add(code) else heldModifiers.remove(code)
      return true
    }
    if (action != "down") return true
    val isControl = heldModifiers.any { it.startsWith("Control") }
    val isAlt = heldModifiers.any { it.startsWith("Alt") }
    val isShift = heldModifiers.any { it.startsWith("Shift") }
    // Block Ctrl+Alt chords such as Ctrl+Alt+Delete, as on Windows.
    if (isControl && isAlt) return false
    if (isControl) return shortcut(code)
    if (isAlt) return false
    return when (code) {
      "Escape" -> service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
      "Enter" -> enter()
      "Tab" -> moveFocus(if (isShift) View.FOCUS_BACKWARD else View.FOCUS_FORWARD)
      "Backspace" -> delete(isBeforeCursor = true)
      "Delete" -> delete(isBeforeCursor = false)
      "ArrowLeft" -> moveCursor(-1)
      "ArrowRight" -> moveCursor(1)
      "ArrowUp" -> moveLine(AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY)
      "ArrowDown" -> moveLine(AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY)
      "Home" -> withField { node, _ -> select(node, 0, 0) }
      "End" -> withField { node, field -> select(node, field.text.length, field.text.length) }
      else -> RemoteKeyText.character(code, isShift)?.let { insert(it.toString()) } ?: false
    }
  }

  fun release() {
    heldModifiers.clear()
  }

  private fun shortcut(code: String): Boolean = withField { node, field ->
    when (code) {
      "KeyA" -> select(node, 0, field.text.length)
      "KeyC" -> node.performAction(AccessibilityNodeInfo.ACTION_COPY)
      "KeyX" -> node.performAction(AccessibilityNodeInfo.ACTION_CUT)
      "KeyV" -> node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
      else -> false
    }
  }

  private fun enter(): Boolean = withField { node, _ ->
    when {
      node.isMultiLine -> insert("\n")
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
        node.performAction(AccessibilityAction.ACTION_IME_ENTER.id)
      else -> false
    }
  }

  private fun insert(value: String): Boolean = withField { node, field ->
    val updated = field.text.substring(0, field.start) + value + field.text.substring(field.end)
    replace(node, updated, field.start + value.length)
  }

  private fun delete(isBeforeCursor: Boolean): Boolean = withField { node, field ->
    val text = field.text
    var start = field.start
    var end = field.end
    if (start == end) {
      if (isBeforeCursor && start > 0) start = text.offsetByCodePoints(start, -1)
      else if (!isBeforeCursor && end < text.length) end = text.offsetByCodePoints(end, 1)
      else return@withField true
    }
    replace(node, text.substring(0, start) + text.substring(end), start)
  }

  private fun moveCursor(direction: Int): Boolean = withField { node, field ->
    val text = field.text
    val cursor = when {
      field.start != field.end -> if (direction < 0) field.start else field.end
      direction < 0 && field.start > 0 -> text.offsetByCodePoints(field.start, -1)
      direction > 0 && field.end < text.length -> text.offsetByCodePoints(field.end, 1)
      else -> field.start
    }
    select(node, cursor, cursor)
  }

  private fun moveLine(action: Int): Boolean = withField { node, _ ->
    val arguments = Bundle().apply {
      putInt(
        AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT,
        AccessibilityNodeInfo.MOVEMENT_GRANULARITY_LINE,
      )
      putBoolean(AccessibilityNodeInfo.ACTION_ARGUMENT_EXTEND_SELECTION_BOOLEAN, false)
    }
    node.performAction(action, arguments)
  }

  private fun moveFocus(direction: Int): Boolean {
    val node = service.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
    val next = node.focusSearch(direction) ?: return false
    return next.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
  }

  private fun replace(node: AccessibilityNodeInfo, text: String, cursor: Int): Boolean {
    val arguments = Bundle().apply {
      putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
    }
    if (!node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)) return false
    select(node, cursor, cursor)
    return true
  }

  private fun select(node: AccessibilityNodeInfo, start: Int, end: Int): Boolean {
    val arguments = Bundle().apply {
      putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, start)
      putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, end)
    }
    return node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, arguments)
  }

  /** Runs [edit] on the focused editable field, or returns false if none. */
  private fun withField(edit: (AccessibilityNodeInfo, Field) -> Boolean): Boolean {
    val node = service.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
    if (!node.isEditable) return false
    val isHint = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && node.isShowingHintText
    val text = if (isHint) "" else node.text?.toString().orEmpty()
    val first = node.textSelectionStart
    val second = node.textSelectionEnd
    val hasSelection = first in 0..text.length && second in 0..text.length
    val start = if (hasSelection) minOf(first, second) else text.length
    val end = if (hasSelection) maxOf(first, second) else text.length
    return edit(node, Field(text, start, end))
  }

  private data class Field(val text: String, val start: Int, val end: Int)

  private companion object {
    val MODIFIERS = setOf(
      "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight",
    )
  }
}

package com.fieldmachine.remote

/**
 * Maps a printable KeyboardEvent.code to the character a US keyboard types.
 * The Windows module injects the same codes as virtual keys, which the
 * tablet's layout then interprets; Android has no key injection, so the
 * character is inserted into the focused field instead.
 */
internal object RemoteKeyText {

  private val unshifted = mapOf(
    "Space" to ' ', "Minus" to '-', "Equal" to '=', "BracketLeft" to '[',
    "BracketRight" to ']', "Backslash" to '\\', "Semicolon" to ';', "Quote" to '\'',
    "Backquote" to '`', "Comma" to ',', "Period" to '.', "Slash" to '/',
  )

  private val shifted = mapOf(
    "Space" to ' ', "Minus" to '_', "Equal" to '+', "BracketLeft" to '{',
    "BracketRight" to '}', "Backslash" to '|', "Semicolon" to ':', "Quote" to '"',
    "Backquote" to '~', "Comma" to '<', "Period" to '>', "Slash" to '?',
  )

  private const val SHIFTED_DIGITS = ")!@#$%^&*("

  fun character(code: String, isShifted: Boolean): Char? {
    if (code.length == 4 && code.startsWith("Key") && code[3] in 'A'..'Z') {
      return if (isShifted) code[3] else code[3].lowercaseChar()
    }
    if (code.length == 6 && code.startsWith("Digit") && code[5] in '0'..'9') {
      return if (isShifted) SHIFTED_DIGITS[code[5] - '0'] else code[5]
    }
    return (if (isShifted) shifted else unshifted)[code]
  }
}

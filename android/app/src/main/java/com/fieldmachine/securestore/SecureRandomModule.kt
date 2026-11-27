package com.fieldmachine.securestore

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.SecureRandom

/** Cryptographic random bytes for the tablet password; Hermes has none. */
class SecureRandomModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun randomBytes(count: Double, promise: Promise) {
    val size = count.toInt()
    if (size < 1 || size > MAX_BYTES) {
      promise.reject(ERROR_CODE, "Unsupported random byte count.")
      return
    }
    val bytes = ByteArray(size).also { SecureRandom().nextBytes(it) }
    val result = Arguments.createArray()
    bytes.forEach { result.pushInt(it.toInt() and 0xFF) }
    promise.resolve(result)
  }

  companion object {
    const val NAME = "FieldMachineSecureRandom"
    private const val MAX_BYTES = 256
    private const val ERROR_CODE = "E_SECURE_RANDOM"
  }
}

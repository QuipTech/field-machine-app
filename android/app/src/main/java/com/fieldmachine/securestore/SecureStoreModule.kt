package com.fieldmachine.securestore

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Android counterpart of windows/FieldMachine/Native/SecureStoreModule.h.
 * Same JS name, methods, key allowlist, size limit, and rejection messages,
 * so src/native/SecureStore.ts works unchanged on both platforms.
 * Values are encrypted with KeystoreCipher and kept in app-private
 * SharedPreferences (android:allowBackup="false" keeps them off backups).
 */
class SecureStoreModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun read(key: String, promise: Promise) {
    try {
      requireAllowedKey(key)
      val stored = preferences().getString(key, null)
      if (stored == null) {
        promise.resolve(null)
        return
      }
      promise.resolve(KeystoreCipher.decrypt(stored))
    } catch (error: Exception) {
      promise.reject(READ_ERROR_CODE, "Secure pairing storage could not be read.", error)
    }
  }

  @ReactMethod
  fun write(key: String, value: String, promise: Promise) {
    try {
      requireAllowedKey(key)
      require(value.isNotEmpty() && value.length <= MAX_VALUE_LENGTH) {
        "Invalid secure storage value size."
      }
      val encrypted = KeystoreCipher.encrypt(value)
      check(preferences().edit().putString(key, encrypted).commit()) {
        "Secure storage could not be written."
      }
      // Read back and decrypt, like the Windows module, to prove the save worked.
      val saved = preferences().getString(key, null)
      check(saved != null && KeystoreCipher.decrypt(saved) == value) {
        "Secure storage verification failed."
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject(WRITE_ERROR_CODE, "Secure pairing storage could not be saved.", error)
    }
  }

  @ReactMethod
  fun remove(key: String, promise: Promise) {
    try {
      requireAllowedKey(key)
      check(preferences().edit().remove(key).commit()) {
        "Secure storage could not be cleared."
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject(REMOVE_ERROR_CODE, "Saved pairing could not be removed.", error)
    }
  }

  private fun preferences() =
    reactApplicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun requireAllowedKey(key: String) {
    require(key in ALLOWED_KEYS) { "Unsupported secure storage key." }
  }

  companion object {
    const val NAME = "FieldMachineSecureStore"
    private const val PREFERENCES_NAME = "field_machine_secure_store"
    private const val MAX_VALUE_LENGTH = 20000
    private val ALLOWED_KEYS = setOf("pairing.staging.v1")
    private const val READ_ERROR_CODE = "E_SECURE_STORE_READ"
    private const val WRITE_ERROR_CODE = "E_SECURE_STORE_WRITE"
    private const val REMOVE_ERROR_CODE = "E_SECURE_STORE_REMOVE"
  }
}

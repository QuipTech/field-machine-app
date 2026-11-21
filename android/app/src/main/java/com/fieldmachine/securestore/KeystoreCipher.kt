package com.fieldmachine.securestore

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypts small strings with an AES-256-GCM key held in Android Keystore.
 * The key never leaves the Keystore, so the stored ciphertext is useless if
 * copied off the tablet. Output format: base64(iv) + ":" + base64(ciphertext).
 */
object KeystoreCipher {
  private const val KEYSTORE = "AndroidKeyStore"
  private const val KEY_ALIAS = "field_machine_secure_store_v1"
  private const val TRANSFORMATION = "AES/GCM/NoPadding"
  private const val TAG_LENGTH_BITS = 128
  private const val SEPARATOR = ":"

  fun encrypt(plainText: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
    val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
    return encode(cipher.iv) + SEPARATOR + encode(cipherBytes)
  }

  fun decrypt(stored: String): String {
    val parts = stored.split(SEPARATOR)
    require(parts.size == 2) { "Stored secure value has an unexpected format." }
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(TAG_LENGTH_BITS, decode(parts[0])))
    return String(cipher.doFinal(decode(parts[1])), Charsets.UTF_8)
  }

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    val existing = keyStore.getKey(KEY_ALIAS, null)
    if (existing is SecretKey) {
      return existing
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    val spec =
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    generator.init(spec)
    return generator.generateKey()
  }

  private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun decode(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)
}

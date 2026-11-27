package com.fieldmachine.remote

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.oney.WebRTCModule.WebRTCModuleOptions

/**
 * Registers the remote-support native modules. Like FieldMachinePackage, they
 * are legacy modules reached through the new-architecture interop layer under
 * the same names the Windows modules use.
 */
class RemoteSupportPackage : BaseReactPackage() {

  init {
    // Android 14+ requires a mediaProjection foreground service while the
    // screen is captured. react-native-webrtc ships one but leaves it off by
    // default; it starts it after the operator accepts the system dialog.
    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      RemoteDesktopInputModule.NAME -> RemoteDesktopInputModule(reactContext)
      RemoteSessionModule.NAME -> RemoteSessionModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      RemoteDesktopInputModule.NAME to RemoteDesktopInputModule::class.java,
      RemoteSessionModule.NAME to RemoteSessionModule::class.java,
    ).mapValues { (name, moduleClass) ->
      ReactModuleInfo(
        name,
        moduleClass.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        false, // isTurboModule
      )
    }
  }
}

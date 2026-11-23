package com.fieldmachine

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.fieldmachine.delivery.DesignDeliveryModule
import com.fieldmachine.securestore.SecureStoreModule
import com.fieldmachine.transfer.PortalTransferModule

/**
 * Registers the app-owned file and storage native modules. They are legacy
 * (non-codegen) modules reached through React Native's new-architecture
 * interop layer, so TurboModuleRegistry.get / NativeModules find them by the
 * same names the Windows modules use, without a codegen spec that would also
 * affect the Windows build. Remote-support modules have their own package.
 */
class FieldMachinePackage : BaseReactPackage() {

  private val moduleClasses =
    mapOf(
      SecureStoreModule.NAME to SecureStoreModule::class.java,
      PortalTransferModule.NAME to PortalTransferModule::class.java,
      DesignDeliveryModule.NAME to DesignDeliveryModule::class.java,
    )

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      SecureStoreModule.NAME -> SecureStoreModule(reactContext)
      PortalTransferModule.NAME -> PortalTransferModule(reactContext)
      DesignDeliveryModule.NAME -> DesignDeliveryModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    moduleClasses.mapValues { (name, moduleClass) ->
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

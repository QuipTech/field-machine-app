import { TurboModuleRegistry, type TurboModule } from 'react-native';

interface DeviceInfoModule extends TurboModule {
  isAppForeground: () => Promise<boolean>;
}

const getDeviceInfo = () => {
  const module = TurboModuleRegistry.get<DeviceInfoModule>(
    'FieldMachineDeviceInfo',
  );
  if (!module) {
    throw new Error('Rebuild Windows to enable foreground detection.');
  }
  return module;
};

export default getDeviceInfo;

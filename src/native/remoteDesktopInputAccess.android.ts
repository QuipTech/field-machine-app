import { NativeModules } from 'react-native';
import type { RemoteDesktopInputAccess } from './remoteDesktopInputAccess';

interface NativeAccess {
  isServiceEnabled: () => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

// Same Kotlin module as remoteDesktopInput.ts; these two methods exist only
// on Android because control needs the operator to enable an accessibility
// service once per tablet.
const nativeAccess: NativeAccess | undefined = NativeModules.FieldMachineRemoteDesktopInput;

const remoteDesktopInputAccess: RemoteDesktopInputAccess = {
  isSetupRequired: true,
  isEnabled: async () => (await nativeAccess?.isServiceEnabled().catch(() => false)) === true,
  openSettings: async () => (await nativeAccess?.openSettings().catch(() => false)) === true,
};

export default remoteDesktopInputAccess;

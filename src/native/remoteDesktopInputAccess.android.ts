import { NativeModules } from 'react-native';
import type { RemoteDesktopInputAccess } from './remoteDesktopInputAccess';

interface NativeAccess {
  isServiceEnabled: () => Promise<boolean>;
  hasConsent: () => Promise<boolean>;
  isConsentDecided: () => Promise<boolean>;
  setConsent: (isAccepted: boolean) => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

// Same Kotlin module as remoteDesktopInput.ts; these methods exist only on
// Android because control needs the operator's consent and an accessibility
// service enabled once per tablet.
const nativeAccess: NativeAccess | undefined = NativeModules.FieldMachineRemoteDesktopInput;

// A missing method (older native build) counts as "no" instead of throwing.
const ask = async (call: () => Promise<boolean> | undefined) => {
  try {
    return (await call()) === true;
  } catch {
    return false;
  }
};

const remoteDesktopInputAccess: RemoteDesktopInputAccess = {
  isSetupRequired: true,
  isEnabled: () => ask(() => nativeAccess?.isServiceEnabled()),
  hasConsent: () => ask(() => nativeAccess?.hasConsent()),
  isConsentDecided: () => ask(() => nativeAccess?.isConsentDecided()),
  setConsent: isAccepted => ask(() => nativeAccess?.setConsent(isAccepted)),
  openSettings: () => ask(() => nativeAccess?.openSettings()),
};

export default remoteDesktopInputAccess;

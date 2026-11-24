// Windows injects input without operator setup, so no access step exists.
// The Android adapter (remoteDesktopInputAccess.android.ts) reports whether
// the accessibility service has been enabled and stores the operator's consent.
export interface RemoteDesktopInputAccess {
  isSetupRequired: boolean;
  isEnabled: () => Promise<boolean>;
  hasConsent: () => Promise<boolean>;
  isConsentDecided: () => Promise<boolean>;
  setConsent: (isAccepted: boolean) => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

const remoteDesktopInputAccess: RemoteDesktopInputAccess = {
  isSetupRequired: false,
  isEnabled: async () => true,
  hasConsent: async () => true,
  isConsentDecided: async () => true,
  setConsent: async () => false,
  openSettings: async () => false,
};

export default remoteDesktopInputAccess;

// Windows injects input without operator setup, so no access step exists.
// The Android adapter (remoteDesktopInputAccess.android.ts) reports whether
// the accessibility service has been enabled.
export interface RemoteDesktopInputAccess {
  isSetupRequired: boolean;
  isEnabled: () => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

const remoteDesktopInputAccess: RemoteDesktopInputAccess = {
  isSetupRequired: false,
  isEnabled: async () => true,
  openSettings: async () => false,
};

export default remoteDesktopInputAccess;

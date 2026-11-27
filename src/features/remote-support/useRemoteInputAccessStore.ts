import { create } from 'zustand';
import remoteDesktopInputAccess from '../../native/remoteDesktopInputAccess';

interface RemoteInputAccessState {
  isServiceEnabled?: boolean;
  hasConsent?: boolean;
  isConsentDecided?: boolean;
  refresh: () => Promise<void>;
  setConsent: (isAccepted: boolean) => Promise<boolean>;
}

// Shared so the setup card and an active session see the same consent.
const useRemoteInputAccessStore = create<RemoteInputAccessState>((set, get) => ({
  refresh: async () => {
    const [isServiceEnabled, hasConsent, isConsentDecided] = await Promise.all([
      remoteDesktopInputAccess.isEnabled(),
      remoteDesktopInputAccess.hasConsent(),
      remoteDesktopInputAccess.isConsentDecided(),
    ]);
    set({ isServiceEnabled, hasConsent, isConsentDecided });
  },
  setConsent: async isAccepted => {
    const isSaved = await remoteDesktopInputAccess.setConsent(isAccepted);
    await get().refresh();
    return isSaved;
  },
}));

export default useRemoteInputAccessStore;

import { create } from 'zustand';
import pairingService from './pairingService';
import type { PairedDevice } from './pairingSchema';

type PairingStatus =
  | 'loading'
  | 'unpaired'
  | 'submitting'
  | 'saving'
  | 'save-failed'
  | 'paired'
  | 'disconnecting'
  | 'forgetting'
  | 'clear-failed'
  | 'blocked';
interface PairingState {
  status: PairingStatus;
  pairedDevice: PairedDevice | null;
  error: string | null;
  restorePairing: () => Promise<void>;
  pairDevice: (code: string) => Promise<void>;
  retrySave: () => Promise<void>;
  forgetPairing: () => Promise<void>;
  revokePairing: (device: PairedDevice) => Promise<void>;
  retryCleanup: () => Promise<void>;
}

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Pairing could not be completed.';

const usePairingStore = create<PairingState>((set, get) => {
  let revision = 0;
  const clearPairing = async () => {
    const current = ++revision;
    // Invalidate in-memory auth immediately; block pairing until deletion finishes.
    set({ status: 'forgetting', pairedDevice: null, error: null });
    try {
      await pairingService.forgetPairing();
      if (current === revision) {
        set({ status: 'unpaired' });
      }
    } catch {
      if (current === revision) {
        set({
          status: 'clear-failed',
          error:
            'Pairing ended. Secure removal failed; retry cleanup before pairing again. Rebuild the Windows app if its native module is outdated.',
        });
      }
    }
  };
  const persistPairing = async (pairedDevice: PairedDevice) => {
    const current = ++revision;
    set({ status: 'saving', pairedDevice, error: null });
    try {
      await pairingService.savePairing(pairedDevice);
      if (current !== revision) {
        return;
      }
      set({ status: 'paired' });
    } catch {
      if (current !== revision) {
        return;
      }
      // Keep the one-time token in memory so saving can be retried without pairing again.
      set({
        status: 'save-failed',
        error:
          'Paired on the server, but secure saving failed. Keep this app open and retry saving.',
      });
    }
  };

  return {
    status: 'loading',
    pairedDevice: null,
    error: null,
    restorePairing: async () => {
      if (
        get().pairedDevice ||
        !['loading', 'unpaired', 'blocked'].includes(get().status)
      ) {
        return;
      }
      const current = ++revision;
      set({ status: 'loading', error: null });
      try {
        const pairedDevice = await pairingService.readSavedPairing();
        if (current !== revision) {
          return;
        }
        set({ pairedDevice, status: pairedDevice ? 'paired' : 'unpaired' });
      } catch (error) {
        if (current === revision) {
          set({ status: 'blocked', error: describeError(error) });
        }
      }
    },
    pairDevice: async code => {
      if (get().status !== 'unpaired') {
        return;
      }
      set({ status: 'submitting', error: null });
      const current = ++revision;
      try {
        const pairedDevice = await pairingService.requestPairing(code);
        if (current !== revision) {
          return;
        }
        await persistPairing(pairedDevice);
      } catch (error) {
        if (current === revision) {
          set({ status: 'unpaired', error: describeError(error) });
        }
      }
    },
    forgetPairing: async () => {
      const { pairedDevice, status } = get();
      if (status !== 'paired' || !pairedDevice) {
        return;
      }
      const current = ++revision;
      // Suspend the socket while retaining auth until the server confirms DELETE.
      set({ status: 'disconnecting', error: null });
      try {
        await pairingService.disconnectSession(pairedDevice.deviceToken);
      } catch (error) {
        if (current === revision && get().pairedDevice === pairedDevice) {
          set({ status: 'paired', error: describeError(error) });
        }
        return;
      }
      if (current === revision && get().pairedDevice === pairedDevice) {
        await clearPairing();
      }
    },
    revokePairing: async device => {
      if (get().pairedDevice !== device) {
        return;
      }
      await clearPairing();
    },
    retryCleanup: async () => {
      if (get().status === 'clear-failed') {
        await clearPairing();
      }
    },
    retrySave: async () => {
      const { pairedDevice, status } = get();
      if (pairedDevice && status === 'save-failed') {
        await persistPairing(pairedDevice);
      }
    },
  };
});

export default usePairingStore;

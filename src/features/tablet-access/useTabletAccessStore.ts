import { create } from 'zustand';
import createTabletPassword from '../../native/createTabletPassword';
import tabletAccessStore from '../../native/TabletAccessStore';
import tabletAccessApi from '../../services/tabletAccessApi';
import pairingService from '../pairing/pairingService';
import usePairingStore from '../pairing/usePairingStore';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import runTabletAccess, { AccessCancelled, type AccessUpdate } from './runTabletAccess';
import type { TabletAccessRecord } from './tabletAccessSchema';

const RESTART_AFTER_ERROR_MS = 30000;

interface TabletAccessState {
  phase: 'idle' | AccessUpdate['phase'] | 'paired' | 'error';
  record: TabletAccessRecord | null;
  notice?: string;
  error?: string;
  start: () => void;
  load: () => Promise<void>;
  changePassword: (password: string) => Promise<string | undefined>;
  confirmPasswordRecorded: () => Promise<void>;
  registerAsNew: () => Promise<void>;
}

let run = 0;

const useTabletAccessStore = create<TabletAccessState>((set, get) => {
  const saveRecord = async (record: TabletAccessRecord) => {
    await tabletAccessStore.write(record);
    set({ record });
  };

  // Keeps working until the tablet has a device token, then hands the device
  // to the pairing store so the existing connection and workspace take over.
  const loop = async (current: number) => {
    const isCancelled = () => current !== run;
    for (;;) {
      try {
        const record = await runTabletAccess({
          store: tabletAccessStore, api: tabletAccessApi,
          readLegacyPairing: pairingService.readLegacyPairing,
          removeLegacyPairing: pairingService.removeLegacyPairing,
          generatePassword: createTabletPassword,
          wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
          isCancelled,
          onUpdate: update => {
            if (!isCancelled()) set({ phase: update.phase, record: update.record ?? get().record, notice: update.notice, error: undefined });
          },
        });
        if (isCancelled() || !record.device) return;
        recordSessionDiagnostic('access', 'device_session_ready');
        set({ phase: 'paired', record, notice: undefined, error: undefined });
        usePairingStore.setState({ status: 'paired', pairedDevice: record.device, error: null });
        return;
      } catch (error) {
        if (error instanceof AccessCancelled || isCancelled()) return;
        recordSessionDiagnostic('access', 'flow_error_retrying');
        set({ phase: 'error', error: error instanceof Error ? error.message : 'Tablet access failed.' });
        await new Promise(resolve => setTimeout(resolve, RESTART_AFTER_ERROR_MS));
        if (isCancelled()) return;
      }
    }
  };

  return {
    phase: 'idle',
    record: null,
    start: () => {
      if (['registering', 'waiting', 'connecting'].includes(get().phase)) return;
      loop(++run);
    },
    load: async () => {
      set({ record: await tabletAccessStore.read().catch(() => get().record) });
    },
    // Returns an error message, or undefined on success.
    changePassword: async password => {
      const record = get().record;
      if (!record) return 'The tablet is not registered yet.';
      const result = await tabletAccessApi.changePassword(record.tabletToken, password);
      if (result.kind === 'ok') {
        await saveRecord({ ...record, password });
        return undefined;
      }
      if (result.kind === 'retry') return 'Cannot reach FIELD. Try again when online.';
      return result.code === 'tablet_password_managed_in_portal'
        ? 'This password is now changed from the FIELD Portal.'
        : 'The password could not be changed.';
    },
    confirmPasswordRecorded: async () => {
      const record = get().record;
      if (!record) return;
      const withoutPassword = { ...record };
      delete withoutPassword.password;
      delete withoutPassword.isPasswordUnconfirmed;
      await saveRecord(withoutPassword);
    },
    // Recovery from the contract's known limitation: nobody knows the password
    // of a removed tablet. Gives the tablet a new FIELD ID.
    registerAsNew: async () => {
      run++;
      await tabletAccessStore.remove();
      set({ phase: 'idle', record: null, notice: undefined, error: undefined });
      usePairingStore.setState({ status: 'unpaired', pairedDevice: null, error: null });
      get().start();
    },
  };
});

export default useTabletAccessStore;

import { Platform } from 'react-native';
import environment from '../../config/environment';
import getSecureStore from '../../native/SecureStore';
import tabletAccessStore from '../../native/TabletAccessStore';
import postPublicJson from '../../services/apiClient';
import disconnectDeviceSession from '../../services/disconnectDeviceSession';
import pairingSchema, {
  pairingCodeSchema,
  type PairedDevice,
} from './pairingSchema';

let storageTask: Promise<void> = Promise.resolve();
// Serialize native storage so an in-flight save cannot recreate deleted auth.
const accessSecureStorage = <T>(operation: () => Promise<T>): Promise<T> => {
  const pending = storageTask.then(operation);
  storageTask = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
};

// Code pairing saved by earlier builds. On Windows it is read once, to upgrade
// the tablet to FIELD ID access, then removed.
const readLegacyPairing = async (): Promise<PairedDevice | null> => {
  const savedPairing = await accessSecureStorage(() =>
    getSecureStore().read(environment.secureStorageKey),
  );
  if (savedPairing === null) {
    return null;
  }
  try {
    const savedValue: unknown = JSON.parse(savedPairing);
    return pairingSchema.parse(savedValue);
  } catch {
    throw new Error(
      'Saved pairing could not be read. Contact support; it has not been deleted.',
    );
  }
};

// Windows keeps the device in the FIELD ID access record (DPAPI, whole tablet).
const readSavedPairing = async (): Promise<PairedDevice | null> => {
  if (!tabletAccessStore.isSupported) return readLegacyPairing();
  const record = await tabletAccessStore.read();
  return record?.device ?? null;
};

const requestPairing = async (enteredCode: string): Promise<PairedDevice> => {
  const code = pairingCodeSchema.parse(enteredCode);
  getSecureStore();
  const response = await postPublicJson(environment.pairingPath, {
    code,
    platform: Platform.OS === 'android' ? 'android' : 'windows',
  });
  const result = pairingSchema.safeParse(response);
  if (!result.success) {
    throw new Error(
      'The server returned an unexpected pairing response. Check the Portal before trying again.',
    );
  }
  return result.data;
};

const savePairing = async (pairedDevice: PairedDevice): Promise<void> => {
  if (tabletAccessStore.isSupported) {
    const record = await tabletAccessStore.read();
    if (!record) throw new Error('This tablet has no FIELD ID yet.');
    await tabletAccessStore.write({ ...record, device: pairedDevice });
    return;
  }
  await accessSecureStorage(() =>
    getSecureStore().write(
      environment.secureStorageKey,
      JSON.stringify(pairedDevice),
    ),
  );
};

const removeLegacyPairing = async (): Promise<void> => {
  await accessSecureStorage(() =>
    getSecureStore().remove(environment.secureStorageKey),
  );
};

// On Windows this drops only the device token; the FIELD ID and tablet token
// stay so the tablet can be re-added and reconnect.
const forgetPairing = async (): Promise<void> => {
  if (tabletAccessStore.isSupported) {
    const record = await tabletAccessStore.read();
    if (record?.device) {
      const withoutDevice = { ...record };
      delete withoutDevice.device;
      await tabletAccessStore.write(withoutDevice);
    }
    return;
  }
  await accessSecureStorage(() =>
    getSecureStore().remove(environment.secureStorageKey),
  );
};

const pairingService = {
  readSavedPairing,
  requestPairing,
  savePairing,
  forgetPairing,
  readLegacyPairing,
  removeLegacyPairing,
  disconnectSession: disconnectDeviceSession,
};
export default pairingService;

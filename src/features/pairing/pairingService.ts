import environment from '../../config/environment';
import getSecureStore from '../../native/SecureStore';
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

const readSavedPairing = async (): Promise<PairedDevice | null> => {
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

const requestPairing = async (enteredCode: string): Promise<PairedDevice> => {
  const code = pairingCodeSchema.parse(enteredCode);
  getSecureStore();
  const response = await postPublicJson(environment.pairingPath, {
    code,
    platform: 'windows',
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
  await accessSecureStorage(() =>
    getSecureStore().write(
      environment.secureStorageKey,
      JSON.stringify(pairedDevice),
    ),
  );
};

const forgetPairing = async (): Promise<void> => {
  await accessSecureStorage(() =>
    getSecureStore().remove(environment.secureStorageKey),
  );
};

const pairingService = {
  readSavedPairing,
  requestPairing,
  savePairing,
  forgetPairing,
  disconnectSession: disconnectDeviceSession,
};
export default pairingService;

import portalTransfer from '../../native/PortalTransfer';
import validateSession from '../../services/deviceSessionService';
import uploadPortalDocument, { type UploadResult } from '../../services/uploadPortalDocument';
import pairingService from '../pairing/pairingService';
import type { PairedDevice } from '../pairing/pairingSchema';
import usePairingStore from '../pairing/usePairingStore';
import getTransferPairing from './getTransferPairing';

import sentFileHistory from './sentFileHistory';

const getActiveDevice = (pairing: string) => {
  const { status, pairedDevice } = usePairingStore.getState();
  return status === 'paired' && pairedDevice && getTransferPairing(pairedDevice) === pairing
    ? pairedDevice
    : null;
};

const readCurrentToken = async (pairing: string) => {
  const saved = await pairingService.readSavedPairing();
  return saved && getTransferPairing(saved) === pairing && getActiveDevice(pairing)
    ? saved.deviceToken
    : null;
};

const recoverRevokedUpload = async (
  originalToken: string, pairing: string, id: string,
): Promise<UploadResult> => {
  const failed: UploadResult = {
    status: 'failed',
    message: 'The Portal could not verify the pairing. Try again when connected.',
    canRetry: true,
    shouldBackoff: false,
  };
  try {
    const latestToken = await readCurrentToken(pairing);
    if (!latestToken) {
      return failed;
    }
    if (latestToken !== originalToken) {
      const result = await uploadPortalDocument(latestToken, pairing, id);
      if (result.status !== 'revoked') {
        return result;
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const session = await validateSession(latestToken, controller.signal)
      .finally(() => clearTimeout(timeout));
    if (session.status === 'revoked' && await readCurrentToken(pairing) === latestToken) {
      const active = getActiveDevice(pairing);
      if (active) {
        await usePairingStore.getState().revokePairing(active);
      }
    }
  } catch {
    return failed;
  }
  return failed;
};

const send = async (device: PairedDevice, id: string, onRetry: () => void) => {
  const pairing = getTransferPairing(device);
  const delays = [0, 1000, 3000];
  for (const delay of delays) {
    if (delay) {
      onRetry();
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
    const active = getActiveDevice(pairing);
    if (!active) {
      return 'The transfer is saved under the original pairing.';
    }
    let result = await uploadPortalDocument(active.deviceToken, pairing, id);
    if (result.status === 'revoked') {
      result = await recoverRevokedUpload(active.deviceToken, pairing, id);
    }
    if (result.status === 'sent') {
      try {
        await sentFileHistory.record(pairing, result.receipt);
      } catch {
        return {
          status: 'history-pending' as const,
          message: 'Sent to Portal. Retry to save the receipt on this tablet.',
          canRetry: true,
        };
      }
      const removed = await portalTransfer.remove(pairing, id).then(() => true, () => false);
      return removed ? result : { ...result, cleanupFailed: true };
    }
    if (result.status === 'failed' && (!result.shouldBackoff || delay === delays.at(-1))) {
      return result;
    }
  }
  return 'The transfer is saved. Try again when connected.';
};

const inFlight = new Map<string, ReturnType<typeof send>>();
const sendPendingTransfer = (device: PairedDevice, id: string, onRetry: () => void) => {
  const key = `${getTransferPairing(device)}/${id}`;
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }
  const task = send(device, id, onRetry).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
};

export default sendPendingTransfer;


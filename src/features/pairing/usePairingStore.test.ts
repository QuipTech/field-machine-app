import pairingService from './pairingService';
import usePairingStore from './usePairingStore';

jest.mock('./pairingService');
const pairedDevice = {
  deviceId: 'a2b1c3d4-1234-4123-8123-123456789012',
  deviceToken: 'test_token',
  machine: { id: 'b2b1c3d4-1234-4123-8123-123456789012', label: 'ASSET-0042' },
};

beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({
    status: 'unpaired',
    pairedDevice: null,
    error: null,
  });
});

test('retries secure saving without sending another pairing request', async () => {
  jest.mocked(pairingService.requestPairing).mockResolvedValue(pairedDevice);
  jest
    .mocked(pairingService.savePairing)
    .mockRejectedValueOnce(new Error('Disk failure'))
    .mockResolvedValueOnce();
  await usePairingStore.getState().pairDevice('123456');
  expect(usePairingStore.getState().status).toBe('save-failed');
  expect(usePairingStore.getState().pairedDevice).toEqual(pairedDevice);
  await usePairingStore.getState().retrySave();
  expect(usePairingStore.getState().status).toBe('paired');
  expect(pairingService.requestPairing).toHaveBeenCalledTimes(1);
});

test('blocks pairing after secure restore failure', async () => {
  jest
    .mocked(pairingService.readSavedPairing)
    .mockRejectedValue(new Error('Vault locked'));
  await usePairingStore.getState().restorePairing();
  await usePairingStore.getState().pairDevice('123456');
  expect(usePairingStore.getState().status).toBe('blocked');
  expect(pairingService.requestPairing).not.toHaveBeenCalled();
});

test('restores saved pairing without a server request', async () => {
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue(pairedDevice);
  await usePairingStore.getState().restorePairing();
  expect(usePairingStore.getState().status).toBe('paired');
  expect(pairingService.requestPairing).not.toHaveBeenCalled();
});

test('returns to pairing only after secure deletion succeeds', async () => {
  usePairingStore.setState({ status: 'paired', pairedDevice });
  jest
    .mocked(pairingService.forgetPairing)
    .mockRejectedValueOnce(new Error('Vault locked'));
  await usePairingStore.getState().forgetPairing();
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('clear-failed');
  jest.mocked(pairingService.forgetPairing).mockResolvedValueOnce();
  await usePairingStore.getState().retryCleanup();
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('unpaired');
  expect(pairingService.requestPairing).not.toHaveBeenCalled();
});

test('revocation is idempotent and old callbacks cannot clear a new pairing', async () => {
  usePairingStore.setState({ status: 'paired', pairedDevice });
  await Promise.all([
    usePairingStore.getState().revokePairing(pairedDevice),
    usePairingStore.getState().revokePairing(pairedDevice),
  ]);
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  const replacement = { ...pairedDevice, deviceToken: 'new_token' };
  jest.mocked(pairingService.requestPairing).mockResolvedValue(replacement);
  await usePairingStore.getState().pairDevice('654321');
  await usePairingStore.getState().revokePairing(pairedDevice);
  expect(usePairingStore.getState().pairedDevice).toBe(replacement);
  expect(usePairingStore.getState().status).toBe('paired');
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
});

test('late storage restore cannot overwrite a cleared pairing', async () => {
  let complete: ((value: typeof pairedDevice) => void) | undefined;
  jest.mocked(pairingService.readSavedPairing).mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  const restoring = usePairingStore.getState().restorePairing();
  usePairingStore.setState({ status: 'paired', pairedDevice });
  await usePairingStore.getState().revokePairing(pairedDevice);
  complete?.(pairedDevice);
  await restoring;
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('unpaired');
});

import usePairingStore from './usePairingStore';
import pairingService from './pairingService';

jest.mock('./pairingService');

const device = {
  deviceId: 'device-1',
  deviceToken: 'test-token',
  machine: { id: 'machine-1', label: 'Test machine' },
};
beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({
    status: 'paired',
    pairedDevice: device,
    error: null,
  });
});

test('keeps auth and blocks duplicate clicks until server disconnect completes', async () => {
  let confirm: (() => void) | undefined;
  jest.mocked(pairingService.disconnectSession).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        confirm = resolve;
      }),
  );
  const disconnecting = usePairingStore.getState().forgetPairing();
  await usePairingStore.getState().forgetPairing();
  expect(usePairingStore.getState().status).toBe('disconnecting');
  expect(usePairingStore.getState().pairedDevice).toBe(device);
  expect(pairingService.disconnectSession).toHaveBeenCalledTimes(1);
  expect(pairingService.disconnectSession).toHaveBeenCalledWith(
    device.deviceToken,
  );
  expect(pairingService.forgetPairing).not.toHaveBeenCalled();
  confirm?.();
  await disconnecting;
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('unpaired');
});

test('failed server disconnect retains saved pairing for retry', async () => {
  jest
    .mocked(pairingService.disconnectSession)
    .mockRejectedValue(new Error('Offline'));
  await usePairingStore.getState().forgetPairing();
  expect(pairingService.forgetPairing).not.toHaveBeenCalled();
  expect(usePairingStore.getState().status).toBe('paired');
  expect(usePairingStore.getState().pairedDevice).toBe(device);
  expect(usePairingStore.getState().error).toBe('Offline');
  jest.mocked(pairingService.disconnectSession).mockResolvedValue();
  await usePairingStore.getState().forgetPairing();
  expect(usePairingStore.getState().status).toBe('unpaired');
});

test('secure cleanup retry does not repeat successful backend disconnect', async () => {
  jest
    .mocked(pairingService.forgetPairing)
    .mockRejectedValueOnce(new Error('Vault locked'));
  await usePairingStore.getState().forgetPairing();
  expect(usePairingStore.getState().status).toBe('clear-failed');
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  await usePairingStore.getState().retryCleanup();
  expect(pairingService.disconnectSession).toHaveBeenCalledTimes(1);
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(2);
  expect(usePairingStore.getState().status).toBe('unpaired');
});

test.each(['resolve', 'reject'])(
  'late DELETE %s cannot overwrite a replacement pairing',
  async outcome => {
    let finish: (() => void) | undefined;
    let fail: ((error: Error) => void) | undefined;
    jest.mocked(pairingService.disconnectSession).mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    );
    const disconnecting = usePairingStore.getState().forgetPairing();
    // A confirmed revocation can independently finish the old pairing.
    await usePairingStore.getState().revokePairing(device);
    const replacement = { ...device, deviceToken: 'replacement-token' };
    jest.mocked(pairingService.requestPairing).mockResolvedValue(replacement);
    await usePairingStore.getState().pairDevice('123456');
    if (outcome === 'resolve') {
      finish?.();
    } else {
      fail?.(new Error('late failure'));
    }
    await disconnecting;
    expect(usePairingStore.getState().pairedDevice).toBe(replacement);
    expect(usePairingStore.getState().status).toBe('paired');
    expect(usePairingStore.getState().error).toBeNull();
    expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
  },
);

test('server-initiated revocation only clears locally and never sends DELETE', async () => {
  await usePairingStore.getState().revokePairing(device);
  expect(pairingService.disconnectSession).not.toHaveBeenCalled();
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
});

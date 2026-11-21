import pairingService from './pairingService';
import getSecureStore from '../../native/SecureStore';
import postPublicJson from '../../services/apiClient';
import { pairingCodeSchema } from './pairingSchema';

jest.mock('../../native/SecureStore');
jest.mock('../../services/apiClient');
const read = jest.fn();
const write = jest.fn();
const remove = jest.fn();
const pairedDevice = {
  deviceId: 'a2b1c3d4-1234-4123-8123-123456789012',
  deviceToken: 'test_token',
  machine: { id: 'b2b1c3d4-1234-4123-8123-123456789012', label: 'ASSET-0042' },
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getSecureStore).mockReturnValue({ read, write, remove });
});

test('normalises the code and sends only accepted fields', async () => {
  jest.mocked(postPublicJson).mockResolvedValue(pairedDevice);
  await expect(pairingService.requestPairing('123 456')).resolves.toEqual(
    pairedDevice,
  );
  expect(postPublicJson).toHaveBeenCalledWith('/mc/device/pair', {
    code: '123456',
    platform: 'windows',
  });
});

test.each(['12345', '1234567', 'abcdef', '１２３４５６'])(
  'rejects invalid code %s',
  code => {
    expect(pairingCodeSchema.safeParse(code).success).toBe(false);
  },
);

test('does not consume a code when the native module is missing', async () => {
  jest.mocked(getSecureStore).mockImplementation(() => {
    throw new Error('Unavailable');
  });
  await expect(pairingService.requestPairing('123456')).rejects.toThrow(
    'Unavailable',
  );
  expect(postPublicJson).not.toHaveBeenCalled();
});

test('rejects malformed server credentials', async () => {
  jest
    .mocked(postPublicJson)
    .mockResolvedValue({ ...pairedDevice, deviceToken: '' });
  await expect(pairingService.requestPairing('123456')).rejects.toThrow(
    'unexpected pairing response',
  );
});

test('restores validated credentials and blocks corrupt saved data', async () => {
  read
    .mockResolvedValueOnce(JSON.stringify(pairedDevice))
    .mockResolvedValueOnce('broken');
  await expect(pairingService.readSavedPairing()).resolves.toEqual(
    pairedDevice,
  );
  await expect(pairingService.readSavedPairing()).rejects.toThrow(
    'has not been deleted',
  );
});

test('uses secure storage for the entire pairing record', async () => {
  await pairingService.savePairing(pairedDevice);
  expect(write).toHaveBeenCalledWith(
    'pairing.staging.v1',
    JSON.stringify(pairedDevice),
  );
});

test('queues deletion after an in-flight save so credentials cannot reappear', async () => {
  let finishSave: (() => void) | undefined;
  write.mockImplementation(
    () =>
      new Promise<void>(resolve => {
        finishSave = resolve;
      }),
  );
  const saving = pairingService.savePairing(pairedDevice);
  const clearing = pairingService.forgetPairing();
  await Promise.resolve();
  expect(remove).not.toHaveBeenCalled();
  finishSave?.();
  await Promise.all([saving, clearing]);
  expect(remove).toHaveBeenCalledWith('pairing.staging.v1');
});

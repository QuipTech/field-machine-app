import portalTransfer from '../../native/PortalTransfer';
import validateSession from '../../services/deviceSessionService';
import pairingService from '../pairing/pairingService';
import usePairingStore from '../pairing/usePairingStore';
import getTransferPairing from './getTransferPairing';
import sendPendingTransfer from './sendPendingTransfer';

import sentFileHistory from './sentFileHistory';

jest.mock('./sentFileHistory', () => ({ record: jest.fn() }));

jest.mock('../../native/PortalTransfer', () => ({
  upload: jest.fn(),
  remove: jest.fn(),
}));
jest.mock('../../services/deviceSessionService', () => jest.fn());
jest.mock('../pairing/pairingService', () => ({ readSavedPairing: jest.fn() }));

const device = {
  deviceId: '5fd1f1a1-b5eb-4c6a-9c52-c8755966daef',
  deviceToken: 'original-token',
  machine: { id: '67ee431b-9acf-46a3-b79e-8ac93811488c', label: 'Test machine' },
};
const id = 'd3662be1-90a6-48af-aad4-a47ef9552311';
const receipt = {
  id: 'document-id',
  fileName: 'report.pdf',
  documentType: 'other',
  uploadedAt: '2026-11-18T18:00:00Z',
};
const sent = { status: 201, body: JSON.stringify(receipt) };
const revoked = { status: 401, body: '{"code":"DEVICE_TOKEN_REVOKED"}' };
const upload = jest.mocked(portalTransfer.upload);
const remove = jest.mocked(portalTransfer.remove);
const readPairing = jest.mocked(pairingService.readSavedPairing);
const validate = jest.mocked(validateSession);
const revokePairing = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({ status: 'paired', pairedDevice: device, revokePairing });
  readPairing.mockResolvedValue(device);
  remove.mockResolvedValue(undefined);
});

test('retries a network failure using the same pairing and transfer ID', async () => {
  jest.useFakeTimers();
  try {
    upload.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(sent);
    const onRetry = jest.fn();
    const task = sendPendingTransfer(device, id, onRetry);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(task).resolves.toMatchObject({ status: 'sent', receipt });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[1]).toEqual(upload.mock.calls[0]);
    expect(remove).toHaveBeenCalledWith(getTransferPairing(device), id);
  } finally {
    jest.useRealTimers();
  }
});

test('sends the same transfer with a newly saved token after rotation', async () => {
  upload.mockResolvedValueOnce(revoked).mockResolvedValueOnce(sent);
  readPairing.mockResolvedValue({ ...device, deviceToken: 'rotated-token' });
  await expect(sendPendingTransfer(device, id, jest.fn())).resolves.toMatchObject({
    status: 'sent',
    receipt,
  });
  expect(upload.mock.calls[1]).toEqual([
    upload.mock.calls[0][0], 'rotated-token', getTransferPairing(device), id,
  ]);
  expect(validate).not.toHaveBeenCalled();
  expect(revokePairing).not.toHaveBeenCalled();
});

test('clears pairing only after the latest token is confirmed revoked', async () => {
  upload.mockResolvedValue(revoked);
  validate.mockResolvedValueOnce({ status: 'unavailable', httpStatus: 401, code: 'unrecognized' });
  await sendPendingTransfer(device, id, jest.fn());
  expect(revokePairing).not.toHaveBeenCalled();

  validate.mockResolvedValueOnce({ status: 'revoked', httpStatus: 401, code: 'DEVICE_TOKEN_REVOKED' });
  await sendPendingTransfer(device, id, jest.fn());
  expect(revokePairing).toHaveBeenCalledWith(device);
  expect(remove).not.toHaveBeenCalled();
});

test('keeps an old transfer off a replacement pairing for the same machine', async () => {
  usePairingStore.setState({ pairedDevice: { ...device, deviceId: id } });
  await sendPendingTransfer(device, id, jest.fn());
  expect(upload).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test.each([
  [400, false],
  [403, true],
  [413, false],
])('reports HTTP %s without dropping the queued file', async (status, canRetry) => {
  upload.mockResolvedValue({ status, body: '{}' });
  await expect(sendPendingTransfer(device, id, jest.fn())).resolves.toMatchObject({
    status: 'failed',
    canRetry,
    shouldBackoff: false,
  });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});

test('keeps the upload queued if the accepted receipt cannot be saved', async () => {
  upload.mockResolvedValue(sent);
  jest.mocked(sentFileHistory.record).mockRejectedValueOnce(new Error('disk full'));
  await expect(sendPendingTransfer(device, id, jest.fn())).resolves.toMatchObject({
    status: 'history-pending', canRetry: true,
  });
  expect(remove).not.toHaveBeenCalled();
  await expect(sendPendingTransfer(device, id, jest.fn())).resolves.toMatchObject({ status: 'sent' });
  expect(upload.mock.calls[1]).toEqual(upload.mock.calls[0]);
  expect(sentFileHistory.record).toHaveBeenLastCalledWith(getTransferPairing(device), receipt);
  expect(remove).toHaveBeenCalledTimes(1);
});

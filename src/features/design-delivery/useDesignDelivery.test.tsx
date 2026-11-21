import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useDesignDelivery from './useDesignDelivery';
import usePairingStore from '../pairing/usePairingStore';
import useConnectionStore from '../connection/useConnectionStore';
import native from '../../native/DesignDelivery';
import designApi from './designApi';
import type { Journal } from './designState';

jest.mock('../../native/DesignDelivery', () => ({
  readJournal: jest.fn(), writeJournal: jest.fn(), stop: jest.fn(),
}));
jest.mock('./designApi');

const device = {
  deviceId: '00000000-0000-4000-8000-000000000001',
  deviceToken: 'token',
  machine: { id: '00000000-0000-4000-8000-000000000002', label: 'Machine' },
};
const deliveryId = '00000000-0000-4000-8000-000000000003';
const journal: Journal = { projects: [], pending: { id: deliveryId, result: { status: 'arrived' } } };
const Harness = () => {
  useDesignDelivery();
  return null;
};

test('replays the journal after REST validation before polling and stops on disconnect', async () => {
  if (!native) {
    throw new Error('Missing native mock.');
  }
  jest.useFakeTimers();
  const readJournal = jest.mocked(native.readJournal);
  readJournal.mockResolvedValue(JSON.stringify(journal));
  jest.mocked(native.writeJournal).mockImplementation(async (_scope, payload) => {
    readJournal.mockResolvedValue(payload);
  });
  const next = jest.fn().mockResolvedValue(null);
  const status = jest.fn().mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue(undefined);
  jest.mocked(designApi).mockReturnValue({ next, status, file: jest.fn() });
  usePairingStore.setState({ status: 'paired', pairedDevice: device });
  useConnectionStore.setState({ status: 'reconnecting', isSessionValid: false });
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Harness />); });
    expect(status).not.toHaveBeenCalled();
    await act(async () => { useConnectionStore.setState({ isSessionValid: true }); });
    expect(status).toHaveBeenCalledWith(deliveryId, { status: 'arrived' });
    expect(next).not.toHaveBeenCalled();
    expect(native.writeJournal).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(1600); });
    expect(status).toHaveBeenCalledTimes(2);
    expect(native.writeJournal).toHaveBeenCalledWith(expect.any(String),
      JSON.stringify({ ...journal, pending: null }));
    expect(next).toHaveBeenCalledTimes(1);
    await act(async () => { usePairingStore.setState({ status: 'disconnecting' }); });
    await act(async () => { await jest.advanceTimersByTimeAsync(20000); });
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
  }
});

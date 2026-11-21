import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useDeviceConnection from './useDeviceConnection';
import startDeviceSession from './startDeviceSession';
import subscribeToAppResume from '../../native/subscribeToAppResume';
import pairingService from '../pairing/pairingService';
import usePairingStore from '../pairing/usePairingStore';
import useConnectionStore from './useConnectionStore';

jest.mock('./startDeviceSession');
jest.mock('./sessionDiagnostics');
jest.mock('../../native/subscribeToAppResume');
jest.mock('../pairing/pairingService');

const device = {
  deviceId: 'device-1',
  deviceToken: 'token',
  machine: { id: 'machine-1', label: 'Test' },
};
const Harness = () => {
  useDeviceConnection();
  return null;
};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let resume = () => {};
let callbacks: Parameters<typeof startDeviceSession>[1] | undefined;
const stop = jest.fn();
const validate = jest.fn(async () => {});
const stopResume = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({
    status: 'loading',
    pairedDevice: null,
    error: null,
  });
  useConnectionStore.setState({ status: 'idle', diagnostics: [] });
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue(device);
  jest.mocked(startDeviceSession).mockImplementation((_device, handlers) => {
    callbacks = handlers;
    return { stop, validate };
  });
  jest.mocked(subscribeToAppResume).mockImplementation(onResume => {
    resume = onResume;
    return stopResume;
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test('restores without Connected, revalidates on resume, and stops work on revocation', async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  expect(startDeviceSession).toHaveBeenCalledTimes(1);
  expect(useConnectionStore.getState().status).toBe('idle');
  resume();
  expect(validate).toHaveBeenCalledTimes(1);
  callbacks?.onStatus('connected');
  expect(useConnectionStore.getState().status).toBe('connected');
  await act(async () => {
    callbacks?.onRevoked();
  });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('unpaired');
  expect(useConnectionStore.getState().status).toBe('idle');
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
  callbacks?.onStatus('connected');
  expect(useConnectionStore.getState().status).toBe('idle');
  resume();
  expect(validate).toHaveBeenCalledTimes(1);
});

test('old callbacks cannot clear or connect the replacement session', async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  const oldCallbacks = callbacks;
  await act(async () => {
    oldCallbacks?.onRevoked();
  });
  const replacement = { ...device, deviceToken: 'new-token' };
  jest.mocked(pairingService.requestPairing).mockResolvedValue(replacement);
  await act(async () => {
    await usePairingStore.getState().pairDevice('123456');
  });
  oldCallbacks?.onRevoked();
  oldCallbacks?.onStatus('connected');
  expect(usePairingStore.getState().pairedDevice).toBe(replacement);
  expect(useConnectionStore.getState().status).toBe('idle');
  callbacks?.onStatus('connected');
  expect(useConnectionStore.getState().status).toBe('connected');
});

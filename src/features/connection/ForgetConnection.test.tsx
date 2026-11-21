import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useDeviceConnection from './useDeviceConnection';
import useConnectionStore from './useConnectionStore';
import usePairingStore from '../pairing/usePairingStore';
import pairingService from '../pairing/pairingService';
import createMachineSocket from '../../services/machineSocket';
import validateSession from '../../services/deviceSessionService';
import subscribeToAppResume from '../../native/subscribeToAppResume';

jest.mock('../pairing/pairingService');
jest.mock('../../services/machineSocket');
jest.mock('../../services/deviceSessionService');
jest.mock('../../native/subscribeToAppResume');
jest.mock('./sessionDiagnostics');

const device = {
  deviceId: 'device-1',
  deviceToken: 'test-token',
  machine: { id: 'machine-1', label: 'Test machine' },
};
const valid = {
  status: 'valid',
  httpStatus: 200,
  code: 'unrecognized',
} as const;
const handlers: Record<string, (payload?: unknown) => void> = {};
const socket = {
  connected: false,
  on: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
};
const Harness = () => {
  useDeviceConnection();
  return null;
};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let resume = () => {};

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.spyOn(globalThis, 'setInterval');
  jest.spyOn(globalThis, 'clearInterval');
  socket.connected = false;
  socket.on.mockImplementation(
    (event: string, callback: (payload: unknown) => void) => {
      handlers[event] = callback;
    },
  );
  socket.disconnect.mockImplementation(() => {
    socket.connected = false;
  });
  jest.mocked(createMachineSocket).mockReturnValue(socket);
  jest.mocked(validateSession).mockResolvedValue(valid);
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue(device);
  jest.mocked(subscribeToAppResume).mockImplementation(onResume => {
    resume = onResume;
    return () => {};
  });
  usePairingStore.setState({
    status: 'loading',
    pairedDevice: null,
    error: null,
  });
  useConnectionStore.setState({ status: 'idle', diagnostics: [] });
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('Forget disconnects the active socket and stops background reconnect and resume work', async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  expect(socket.connect).toHaveBeenCalledTimes(1);
  await act(async () => {
    socket.connected = true;
    handlers.connect();
  });
  expect(useConnectionStore.getState().status).toBe('connected');
  const oldDisconnect = handlers.disconnect;
  const oldConnect = handlers.connect;
  await act(async () => {
    await usePairingStore.getState().forgetPairing();
  });

  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
  expect(usePairingStore.getState().pairedDevice).toBeNull();
  expect(usePairingStore.getState().status).toBe('unpaired');
  expect(useConnectionStore.getState().status).toBe('idle');
  const validationCount = jest.mocked(validateSession).mock.calls.length;
  const connectionCount = socket.connect.mock.calls.length;
  await act(async () => {
    oldDisconnect('transport close');
    oldConnect();
    resume();
    jest.advanceTimersByTime(60000);
  });
  expect(validateSession).toHaveBeenCalledTimes(validationCount);
  expect(socket.connect).toHaveBeenCalledTimes(connectionCount);
  expect(useConnectionStore.getState().status).toBe('idle');
  expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 15000);
  expect(clearInterval).toHaveBeenCalledWith(
    jest.mocked(setInterval).mock.results[0]?.value,
  );
});

test('Forget aborts validation and ignores a late success from before cleanup', async () => {
  let complete: ((value: typeof valid) => void) | undefined;
  jest.mocked(validateSession).mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  const signal = jest.mocked(validateSession).mock.calls[0]?.[1];
  expect(signal?.aborted).toBe(false);
  await act(async () => {
    await usePairingStore.getState().forgetPairing();
    complete?.(valid);
  });
  expect(signal?.aborted).toBe(true);
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(socket.connect).not.toHaveBeenCalled();
  expect(useConnectionStore.getState().status).toBe('idle');
  expect(usePairingStore.getState().status).toBe('unpaired');
  expect(clearInterval).toHaveBeenCalledWith(
    jest.mocked(setInterval).mock.results[0]?.value,
  );
});

test('socket and background work stop while backend DELETE is still pending', async () => {
  let confirm: (() => void) | undefined;
  jest.mocked(pairingService.disconnectSession).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        confirm = resolve;
      }),
  );
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  const validations = jest.mocked(validateSession).mock.calls.length;
  let disconnecting: Promise<void> | undefined;
  await act(async () => {
    disconnecting = usePairingStore.getState().forgetPairing();
  });
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(usePairingStore.getState().status).toBe('disconnecting');
  expect(usePairingStore.getState().pairedDevice).toBe(device);
  expect(pairingService.forgetPairing).not.toHaveBeenCalled();
  await act(async () => {
    resume();
    jest.advanceTimersByTime(60000);
  });
  expect(validateSession).toHaveBeenCalledTimes(validations);
  await act(async () => {
    confirm?.();
    await disconnecting;
  });
  expect(usePairingStore.getState().status).toBe('unpaired');
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
});

import startDeviceSession from './startDeviceSession';
import createMachineSocket from '../../services/machineSocket';
import validateSession from '../../services/deviceSessionService';
import recordSessionDiagnostic from './sessionDiagnostics';

jest.mock('../../services/machineSocket');
jest.mock('../../services/deviceSessionService');
jest.mock('./sessionDiagnostics');
jest.mock('./probeEndedSession');

const device = {
  deviceId: 'device-1',
  deviceToken: 'private-token',
  machine: { id: 'machine-1', label: 'Test machine' },
};
const handlers: Record<string, (payload?: unknown) => void> = {};
const socket = {
  connected: false,
  on: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
};
const callbacks = { onStatus: jest.fn(), onRevoked: jest.fn() };
const valid = {
  status: 'valid',
  httpStatus: 200,
  code: 'unrecognized',
} as const;
const revoked = {
  status: 'revoked',
  httpStatus: 401,
  code: 'DEVICE_TOKEN_REVOKED',
} as const;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
let session: ReturnType<typeof startDeviceSession> | undefined;

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  socket.connected = false;
  socket.on.mockImplementation(
    (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler;
    },
  );
  jest.mocked(createMachineSocket).mockReturnValue(socket);
  jest.mocked(validateSession).mockResolvedValue(valid);
});
afterEach(() => {
  session?.stop();
  jest.useRealTimers();
});

test('registers listeners before connecting and requires REST plus socket for Connected', async () => {
  socket.connect.mockImplementation(() => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining([
        'connect',
        'connect_error',
        'disconnect',
        'session:ended',
      ]),
    );
  });
  session = startDeviceSession(device, callbacks);
  await flush();
  expect(createMachineSocket).toHaveBeenCalledWith(device.deviceToken);
  expect(callbacks.onStatus).not.toHaveBeenCalledWith('connected');
  socket.connected = true;
  handlers.connect();
  await flush();
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('connected');
});

test('portal event ends once; stale validation cannot restore Connected', async () => {
  let complete: ((value: typeof valid) => void) | undefined;
  jest.mocked(validateSession).mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  session = startDeviceSession(device, callbacks);
  const ended = {
    deviceId: device.deviceId,
    machineId: device.machine.id,
    reason: 'portal_disconnected',
  };
  handlers['session:ended'](ended);
  handlers['session:ended'](ended);
  socket.connected = true;
  complete?.(valid);
  await flush();
  expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
  expect(socket.disconnect).toHaveBeenCalled();
  expect(callbacks.onStatus).not.toHaveBeenCalledWith('connected');
  expect(recordSessionDiagnostic).toHaveBeenCalledWith(
    'session:ended',
    'portal_disconnected',
  );
});

test('revoked socket authentication uses the same cleanup', async () => {
  session = startDeviceSession(device, callbacks);
  handlers.connect_error(new Error('DEVICE_TOKEN_REVOKED'));
  await flush();
  expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
});

test('revoked startup token ends pairing without opening a socket', async () => {
  jest.mocked(validateSession).mockResolvedValue(revoked);
  session = startDeviceSession(device, callbacks);
  await flush();
  expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
  expect(socket.connect).not.toHaveBeenCalled();
});

test('server disconnect detects revocation even when end event was missed', async () => {
  session = startDeviceSession(device, callbacks);
  await flush();
  jest.mocked(validateSession).mockResolvedValue(revoked);
  handlers.disconnect('io server disconnect');
  await flush();
  expect(callbacks.onRevoked).toHaveBeenCalledTimes(1);
  expect(recordSessionDiagnostic).toHaveBeenCalledWith(
    'disconnect',
    'io server disconnect',
  );
});

test('temporary network loss retains pairing and retries when online', async () => {
  jest.mocked(validateSession).mockRejectedValue(new Error('network down'));
  session = startDeviceSession(device, callbacks);
  await flush();
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('reconnecting');
  expect(callbacks.onRevoked).not.toHaveBeenCalled();
  jest.mocked(validateSession).mockResolvedValue(valid);
  jest.advanceTimersByTime(15000);
  await flush();
  expect(socket.connect).toHaveBeenCalled();
  socket.connected = true;
  handlers.connect();
  await flush();
  expect(callbacks.onStatus).toHaveBeenLastCalledWith('connected');
});

test('stopped session ignores old events and pending responses after re-pairing', async () => {
  session = startDeviceSession(device, callbacks);
  session.stop();
  handlers.connect_error(new Error('DEVICE_TOKEN_REVOKED'));
  handlers['session:ended']({
    deviceId: device.deviceId,
    machineId: device.machine.id,
    reason: 'replaced',
  });
  await flush();
  expect(callbacks.onRevoked).not.toHaveBeenCalled();
  expect(callbacks.onStatus).not.toHaveBeenCalledWith('connected');
});

test('unknown errors and mismatched events are redacted and do not delete pairing', async () => {
  session = startDeviceSession(device, callbacks);
  await flush();
  handlers.connect_error(new Error(device.deviceToken));
  handlers['session:ended']({
    deviceId: 'other',
    machineId: 'other',
    reason: 'replaced',
  });
  await flush();
  expect(callbacks.onRevoked).not.toHaveBeenCalled();
  expect(
    JSON.stringify(jest.mocked(recordSessionDiagnostic).mock.calls),
  ).not.toContain(device.deviceToken);
});

import { z } from 'zod';
import type { PairedDevice } from '../pairing/pairingSchema';
import createMachineSocket from '../../services/machineSocket';
import validateSession from '../../services/deviceSessionService';
import recordSessionDiagnostic from './sessionDiagnostics';
import type { ConnectionStatus } from './useConnectionStore';
import probeEndedSession from './probeEndedSession';

const endedSchema = z.object({
  deviceId: z.string(),
  machineId: z.string(),
  reason: z.enum([
    'portal_disconnected',
    'tablet_disconnected',
    'replaced',
    'connection_timeout',
  ]),
});
interface Callbacks {
  onStatus: (status: ConnectionStatus) => void;
  onValidation?: (isValid: boolean) => void;
  onRevoked: () => void;
  onRemoteSessionChanged?: () => void;
}

const startDeviceSession = (device: PairedDevice, callbacks: Callbacks) => {
  const socket = createMachineSocket(device.deviceToken);
  let isStopped = false;
  let hasEnded = false;
  let request: AbortController | undefined;
  let revision = 0;

  const revoke = () => {
    if (isStopped || hasEnded) {
      return;
    }
    hasEnded = true;
    revision += 1;
    request?.abort();
    socket.disconnect();
    callbacks.onRevoked();
  };

  const validate = async (shouldConnect = true) => {
    if (isStopped || hasEnded) {
      return;
    }
    const current = ++revision;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    if (!socket.connected) {
      callbacks.onStatus('validating');
    }
    try {
      const result = await validateSession(
        device.deviceToken,
        controller.signal,
      );
      if (isStopped || hasEnded || current !== revision) {
        return;
      }
      recordSessionDiagnostic(
        'session:validation',
        `${result.httpStatus} ${result.status} ${result.code}`,
      );
      if (result.status === 'revoked') {
        revoke();
        return;
      }
      if (result.status !== 'valid') {
        callbacks.onValidation?.(false);
        callbacks.onStatus('reconnecting');
        return;
      }
      callbacks.onValidation?.(true);
      callbacks.onStatus(socket.connected ? 'connected' : 'reconnecting');
      if (!socket.connected && shouldConnect) {
        socket.connect();
      }
    } catch {
      if (!isStopped && !hasEnded && current === revision) {
        callbacks.onValidation?.(false);
        recordSessionDiagnostic(
          'session:validation',
          'transport_failure_or_timeout',
        );
        callbacks.onStatus('reconnecting');
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  // Register every handler before the first connect; validation gates connection.
  socket.on('connect', () => {
    if (!isStopped && !hasEnded) {
      recordSessionDiagnostic('connect', 'authenticated_socket_connected');
      validate();
      callbacks.onRemoteSessionChanged?.();
    }
  });
  const remoteHintSchema = z.object({
    sessionId: z.string().uuid(),
    deviceId: z.string(),
    machineId: z.string(),
  });
  for (const event of ['requested', 'accepted', 'declined', 'ended', 'recording', 'help_requested']) {
    socket.on(`remote:${event}`, payload => {
      const hint = remoteHintSchema.safeParse(payload);
      if (!isStopped && !hasEnded && hint.success &&
          hint.data.deviceId === device.deviceId && hint.data.machineId === device.machine.id) {
        callbacks.onRemoteSessionChanged?.();
      }
    });
  }
  socket.on('session:ended', (payload: unknown) => {
    if (isStopped || hasEnded) {
      return;
    }
    const result = endedSchema.safeParse(payload);
    if (
      !result.success ||
      result.data.deviceId !== device.deviceId ||
      result.data.machineId !== device.machine.id
    ) {
      recordSessionDiagnostic('session:ended', 'invalid_or_unmatched_payload');
      validate();
      return;
    }
    recordSessionDiagnostic('session:ended', result.data.reason);
    probeEndedSession(device.deviceToken);
    revoke();
  });
  socket.on('connect_error', (error: unknown) => {
    if (isStopped || hasEnded) {
      return;
    }
    const message = error instanceof Error ? error.message : '';
    const knownErrors = [
      'DEVICE_TOKEN_REVOKED',
      'unauthorized',
      'Unauthorized',
      'Invalid namespace',
      'timeout',
      'websocket error',
    ];
    const isRevoked = message === 'DEVICE_TOKEN_REVOKED';
    recordSessionDiagnostic(
      'connect_error',
      knownErrors.includes(message) ? message : 'connection_failed_redacted',
    );
    callbacks.onStatus('reconnecting');
    if (isRevoked) {
      revoke();
      return;
    }
    validate(false);
  });
  socket.on('disconnect', (reason: unknown) => {
    if (isStopped) {
      return;
    }
    const knownReasons = [
      'io server disconnect',
      'io client disconnect',
      'ping timeout',
      'transport close',
      'transport error',
      'parse error',
    ];
    recordSessionDiagnostic(
      'disconnect',
      typeof reason === 'string' && knownReasons.includes(reason)
        ? reason
        : 'unknown_redacted',
    );
    if (hasEnded) {
      return;
    }
    callbacks.onStatus('reconnecting');
    validate();
  });
  const interval = setInterval(() => {
    validate();
  }, 15000);
  validate();

  const stop = () => {
    isStopped = true;
    revision += 1;
    clearInterval(interval);
    request?.abort();
    socket.removeAllListeners();
    socket.disconnect();
  };
  return { stop, validate };
};

export default startDeviceSession;

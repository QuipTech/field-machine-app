import { io } from 'socket.io-client';
import createMachineSocket from './machineSocket';
import environment from '../config/environment';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

test('uses authenticated Socket.IO namespace with explicit transport path and deferred connect', () => {
  const previousUrl = environment.apiBaseUrl;
  environment.apiBaseUrl = `${previousUrl}/api`;
  try {
    createMachineSocket('private-token');
    expect(io).toHaveBeenCalledWith(`${previousUrl}/machine-app`, {
      path: '/socket.io',
      auth: { deviceToken: 'private-token' },
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      timeout: 15000,
      transports: ['websocket'],
    });
  } finally {
    environment.apiBaseUrl = previousUrl;
  }
});

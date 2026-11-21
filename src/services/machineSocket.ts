import { io } from 'socket.io-client';
import environment from '../config/environment';

export interface MachineSocket {
  readonly connected: boolean;
  on: (event: string, handler: (payload: unknown) => void) => void;
  connect: () => void;
  disconnect: () => void;
  removeAllListeners: () => void;
}

const createMachineSocket = (deviceToken: string): MachineSocket => {
  const origin = new URL(environment.apiBaseUrl).origin;
  const socket = io(`${origin}${environment.socketNamespace}`, {
    path: environment.socketPath,
    auth: { deviceToken },
    autoConnect: false,
    reconnection: false,
    forceNew: true,
    timeout: 15000,
    // Use React Native's built-in WebSocket transport on Windows and Android.
    transports: ['websocket'],
  });
  return {
    get connected() {
      return socket.connected;
    },
    on: (event, handler) => {
      socket.on(event, handler);
    },
    connect: () => {
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
    },
    removeAllListeners: () => {
      socket.removeAllListeners();
    },
  };
};

export default createMachineSocket;

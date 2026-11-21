const { io } = require('socket.io-client');

const backendUrl = process.argv[2];
if (!backendUrl) {
  throw new Error('Pass the confirmed backend URL as the only argument.');
}

// Anonymous deployment probe only. Never pass a token on the command line.
const socket = io(`${new URL(backendUrl).origin}/machine-app`, {
  autoConnect: false,
  reconnection: false,
  transports: ['websocket'],
  path: '/socket.io',
  timeout: 10000,
  auth: {},
});
const finish = (event, detail) => {
  console.info(JSON.stringify({ event, detail, authenticated: false }));
  socket.removeAllListeners();
  socket.disconnect();
};
socket.on('connect', () => finish('connect', 'anonymous_namespace_accepted'));
socket.on('connect_error', error => finish('connect_error', error.message));
socket.connect();

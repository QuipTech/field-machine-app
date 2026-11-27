// Only Android pauses the app's timers when minimised; other platforms do nothing.
const remoteSessionPresence = {
  start: (_onEndRequested: () => void): (() => void) => () => undefined,
};

export default remoteSessionPresence;

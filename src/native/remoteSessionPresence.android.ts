import { AppRegistry, DeviceEventEmitter, NativeModules } from 'react-native';

interface NativeSession {
  start: () => void;
  stop: () => void;
}

const nativeSession: NativeSession | undefined = NativeModules.FieldMachineRemoteSession;

let isActive = false;
let finishTask: (() => void) | undefined;

// While this task is pending, React Native keeps timers (heartbeat, polling,
// socket keep-alive) running even when the app is in the background.
AppRegistry.registerHeadlessTask('FieldRemoteSession', () => () =>
  new Promise<void>(resolve => {
    if (!isActive) {
      resolve();
      return;
    }
    finishTask = resolve;
  }));

const remoteSessionPresence = {
  // Returns a function that removes the marker and releases the task.
  start: (onEndRequested: () => void) => {
    const subscription = DeviceEventEmitter.addListener('fieldRemoteSessionEnd', onEndRequested);
    isActive = true;
    nativeSession?.start();
    return () => {
      isActive = false;
      subscription.remove();
      nativeSession?.stop();
      finishTask?.();
      finishTask = undefined;
    };
  },
};

export default remoteSessionPresence;

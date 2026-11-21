import { useState } from 'react';
import getScreenCapture from '../../native/ScreenCapture';
import getInputControl from '../../native/InputControl';
import runFolderCheck from './runFolderCheck';

const useCapabilityChecks = () => {
  const [result, setResult] = useState('Windows checks have not run.');
  const [isBusy, setIsBusy] = useState(false);
  const [snapshotUri, setSnapshotUri] = useState<string>();

  const run = async (action: () => Promise<string>) => {
    setIsBusy(true);
    try {
      setResult(await action());
    } catch (error: unknown) {
      if (typeof error === 'string') {
        setResult(error);
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        setResult(error.message);
      } else {
        setResult('Unexpected failure: no error message was provided.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const capture = async (shouldStart: boolean) => {
    const module = getScreenCapture();
    if (!module) {
      throw new Error(
        'Blocked: ScreenCapture native module is not registered.',
      );
    }
    if (shouldStart) {
      await module.start();
      return 'Primary monitor capture started. Inspect diagnostics and snapshot.';
    }
    await module.stop();
    setSnapshotUri(undefined);
    return 'Capture stop requested. Verify the capture indicator has stopped.';
  };

  const clickTarget = async () => {
    const module = getInputControl();
    if (!module) {
      throw new Error('Blocked: InputControl native module is not registered.');
    }
    await module.clickTestTarget();
    return 'Dedicated native target confirmed receipt of the injected click.';
  };

  const inspectCapture = async () => {
    const module = getScreenCapture();
    if (!module) {
      throw new Error(
        'Blocked: ScreenCapture native module is not registered.',
      );
    }
    const status = await module.getStatus();
    setSnapshotUri(await module.getSnapshot());
    return status;
  };

  return {
    result,
    snapshotUri,
    isBusy,
    checkFolder: (root: string) => run(() => runFolderCheck(root)),
    startCapture: () => run(() => capture(true)),
    stopCapture: () => run(() => capture(false)),
    clickTarget: () => run(clickTarget),
    inspectCapture: () => run(inspectCapture),
  };
};

export default useCapabilityChecks;

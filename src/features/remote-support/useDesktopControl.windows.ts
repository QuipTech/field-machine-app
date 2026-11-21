import { useLayoutEffect, useRef, useState } from 'react';
import remoteDesktopInput from '../../native/remoteDesktopInput.windows';
import remoteInputSchema from './remoteInputSchema';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';

const useDesktopControl = (owner: string | undefined) => {
  const activeOwner = useRef<string>(undefined);
  const [readyOwner, setReadyOwner] = useState<string>();
  useLayoutEffect(() => {
    if (!owner) return;
    let stopped = false;
    remoteDesktopInput.start(owner).catch(() => false).then(isReady => {
      if (stopped) return;
      activeOwner.current = isReady ? owner : undefined;
      setReadyOwner(activeOwner.current);
      recordSessionDiagnostic('remote:control', isReady ? 'native_ready' : 'native_unavailable');
    });
    return () => {
      stopped = true;
      activeOwner.current = undefined;
      remoteDesktopInput.reset(owner, true);
      setReadyOwner(undefined);
    };
  }, [owner]);

  const onControlMessage = (message: string) => {
    if (!owner || activeOwner.current !== owner) return;
    if (message === 'control-release') {
      remoteDesktopInput.reset(owner, false);
      return;
    }
    if (!message.startsWith('control:') || message.length > 8200) return;
    try {
      const result = remoteInputSchema.safeParse(JSON.parse(message.slice(8)), { jitless: true });
      if (!result.success) return;
      const { type } = result.data;
      if (__DEV__) console.debug('[remote-control] received', type);
      remoteDesktopInput.apply(owner, result.data).catch(() => false).then(applied => {
        if (__DEV__) console.debug('[remote-control] injection', type, applied ? 'ok' : 'rejected');
      });
    } catch {
      // Invalid bridge message. Never log its contents.
    }
  };

  return { isControlReady: Boolean(owner && readyOwner === owner), onControlMessage };
};

export default useDesktopControl;

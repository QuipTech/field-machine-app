import { useEffect, useState } from 'react';
import remoteDesktopInputAccess from '../../native/remoteDesktopInputAccess';
import subscribeToAppResume from '../../native/subscribeToAppResume';

// Re-checks when the app returns to the foreground, which is when the
// operator comes back from Settings > Accessibility.
const useRemoteInputAccess = () => {
  const { isSetupRequired } = remoteDesktopInputAccess;
  const [isEnabled, setIsEnabled] = useState<boolean>();
  useEffect(() => {
    let isStopped = false;
    const refresh = () => {
      remoteDesktopInputAccess.isEnabled().then(value => {
        if (!isStopped) setIsEnabled(value);
      });
    };
    refresh();
    const unsubscribe = subscribeToAppResume(refresh);
    return () => {
      isStopped = true;
      unsubscribe();
    };
  }, []);
  return { isSetupRequired, isEnabled, openSettings: remoteDesktopInputAccess.openSettings };
};

export default useRemoteInputAccess;

import { useEffect } from 'react';
import remoteDesktopInputAccess from '../../native/remoteDesktopInputAccess';
import subscribeToAppResume from '../../native/subscribeToAppResume';
import useRemoteInputAccessStore from './useRemoteInputAccessStore';

// Re-checks when the app returns to the foreground, which is when the
// operator comes back from Settings > Accessibility.
const useRemoteInputAccess = () => {
  const isServiceEnabled = useRemoteInputAccessStore(state => state.isServiceEnabled);
  const hasConsent = useRemoteInputAccessStore(state => state.hasConsent);
  const isConsentDecided = useRemoteInputAccessStore(state => state.isConsentDecided);
  const refresh = useRemoteInputAccessStore(state => state.refresh);
  const setConsent = useRemoteInputAccessStore(state => state.setConsent);
  useEffect(() => {
    refresh();
    return subscribeToAppResume(() => { refresh(); });
  }, [refresh]);
  const isChecked = isServiceEnabled !== undefined && hasConsent !== undefined;
  return {
    isSetupRequired: remoteDesktopInputAccess.isSetupRequired,
    isEnabled: isChecked ? isServiceEnabled && hasConsent : undefined,
    isServiceEnabled,
    hasConsent,
    isConsentDecided,
    setConsent,
    openSettings: remoteDesktopInputAccess.openSettings,
  };
};

export default useRemoteInputAccess;

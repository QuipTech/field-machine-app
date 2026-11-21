import { useEffect } from 'react';
import subscribeToAppResume from '../../native/subscribeToAppResume';
import usePairingStore from '../pairing/usePairingStore';
import startDeviceSession from './startDeviceSession';
import useConnectionStore from './useConnectionStore';
import recordSessionDiagnostic from './sessionDiagnostics';
import environment from '../../config/environment';

const useDeviceConnection = () => {
  useEffect(() => {
    recordSessionDiagnostic('backend', environment.apiBaseUrl);
    let activeDevice = usePairingStore.getState().pairedDevice;
    let session: ReturnType<typeof startDeviceSession> | undefined;
    const synchronize = () => {
      const { status, pairedDevice } = usePairingStore.getState();
      const device = status === 'paired' ? pairedDevice : null;
      if (device === activeDevice && session) {
        return;
      }
      session?.stop();
      session = undefined;
      activeDevice = device;
      useConnectionStore.setState({ status: 'idle', isSessionValid: false });
      if (!device) {
        return;
      }
      session = startDeviceSession(device, {
        onRemoteSessionChanged: () => {
          useConnectionStore.setState(state => ({
            remoteSessionRevision: state.remoteSessionRevision + 1,
          }));
        },
        onValidation: isValid => {
          if (usePairingStore.getState().pairedDevice === device) {
            useConnectionStore.setState({ isSessionValid: isValid });
          }
        },
        onStatus: connectionStatus => {
          if (usePairingStore.getState().pairedDevice === device) {
            useConnectionStore.setState({ status: connectionStatus });
          }
        },
        onRevoked: () => {
          usePairingStore.getState().revokePairing(device);
        },
      });
    };
    const unsubscribe = usePairingStore.subscribe(synchronize);
    synchronize();
    usePairingStore.getState().restorePairing();
    const stopResume = subscribeToAppResume(
      () => {
        session?.validate();
      },
      () =>
        recordSessionDiagnostic(
          'resume',
          'foreground_module_missing_rebuild_required',
        ),
    );
    return () => {
      unsubscribe();
      stopResume();
      session?.stop();
      useConnectionStore.setState({ status: 'idle', isSessionValid: false });
    };
  }, []);
};

export default useDeviceConnection;

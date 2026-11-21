import { useEffect, useState } from 'react';
import heartbeatRemoteSession from '../../services/heartbeatRemoteSession';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';

const useScreenPeerHeartbeat = (deviceToken: string, sessionId: string) => {
  const [hasUnconfirmedSession, setHasUnconfirmedSession] = useState(false);
  useEffect(() => {
    setHasUnconfirmedSession(false);
    let stopped = false;
    let request: AbortController | undefined;
    const heartbeat = async () => {
      if (request) {
        return;
      }
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);
      const isActive = await heartbeatRemoteSession(deviceToken, sessionId, controller.signal)
        .catch(() => false);
      clearTimeout(timeout);
      request = undefined;
      if (!stopped) {
        recordSessionDiagnostic('remote:heartbeat', isActive ? 'active_session_confirmed' : 'active_session_unconfirmed');
        setHasUnconfirmedSession(!isActive);
      }
    };
    const interval = setInterval(heartbeat, 15000);
    heartbeat();
    return () => {
      stopped = true;
      clearInterval(interval);
      request?.abort();
    };
  }, [deviceToken, sessionId]);
  return hasUnconfirmedSession;
};

export default useScreenPeerHeartbeat;

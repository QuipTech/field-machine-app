import { useEffect, useRef } from 'react';
import remoteSessionPresence from '../../native/remoteSessionPresence';

// Keeps the session running in the background and offers End from the marker.
const useSessionPresence = (sessionId: string | undefined, onEnd: (sessionId: string) => void) => {
  const endHandler = useRef(onEnd);
  useEffect(() => {
    endHandler.current = onEnd;
  });
  useEffect(() => {
    if (!sessionId) return;
    return remoteSessionPresence.start(() => endHandler.current(sessionId));
  }, [sessionId]);
};

export default useSessionPresence;

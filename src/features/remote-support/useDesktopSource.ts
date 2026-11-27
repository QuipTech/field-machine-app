import { useEffect, useState, type RefObject } from 'react';
import desktopHost from '../../native/desktopHost';
import { LTSC_PICKER_ORIGIN } from '../../native/ltscScreenPicker';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';

const PANEL_MESSAGES: Record<string, string> = {
  'microphone-on': 'Microphone is on.',
  'microphone-off': 'Microphone is off.',
  'microphone-unavailable': 'Windows could not use the microphone for this user.',
};

interface Options {
  deviceToken: string;
  sessionId: string;
  transferPairing?: string;
  isReady: boolean;
  frame: RefObject<HTMLIFrameElement | null>;
  onFailure: (message: string) => void;
}

// Uses the installed FIELD Machine Desktop service when present. It shares the
// whole screen of whichever Windows user is active, so no screen picker is shown.
// isDesktop is undefined while checking and false when the picker must be used.
const useDesktopSource = ({ deviceToken, sessionId, transferPairing, isReady, frame, onFailure }: Options) => {
  const [isDesktop, setIsDesktop] = useState<boolean>();
  const [isServiceMissing, setIsServiceMissing] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!desktopHost.isSupported || !transferPairing) {
      setIsDesktop(false);
      return;
    }
    let stopped = false;
    desktopHost.start(deviceToken, sessionId, transferPairing).then(mode => {
      if (stopped) return;
      recordSessionDiagnostic('remote:desktop', mode ? `source_${mode}` : 'source_picker');
      setIsServiceMissing(mode === 'local');
      setIsDesktop(mode !== null);
    });
    return () => {
      stopped = true;
      setIsDesktop(undefined);
      desktopHost.stop();
    };
  }, [deviceToken, isReady, sessionId, transferPairing]);

  useEffect(() => {
    if (!isDesktop) return;
    const post = (message: object) => frame.current?.contentWindow?.postMessage(message, LTSC_PICKER_ORIGIN);
    const stopFrames = desktopHost.onFrame(data => post({ type: 'desktop-frame', data }));
    const stopEvents = desktopHost.onEvent(event => {
      if (event.event === 'mic') post({ type: 'set-microphone', on: event.on });
      if (event.event === 'denied' || event.event === 'ended') {
        recordSessionDiagnostic('remote:desktop', event.event);
        onFailure('The FIELD Portal session is no longer active.');
      }
    });
    return () => {
      stopFrames();
      stopEvents();
    };
  }, [frame, isDesktop, onFailure]);

  // Reports microphone results from the sharing page to the support panel.
  const onPageMessage = (message: string) => {
    const text = PANEL_MESSAGES[message];
    if (text && isDesktop) desktopHost.notify(text);
    return Boolean(text);
  };

  return { isDesktop, isServiceMissing, onPageMessage };
};

export default useDesktopSource;

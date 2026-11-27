import { useEffect, useLayoutEffect, useRef } from 'react';
import desktopHost from '../../native/desktopHost';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import type { PairedDevice } from '../pairing/pairingSchema';
import sendPendingTransfer from '../portal-transfer/sendPendingTransfer';
import type { RemoteSessionAction } from '../../services/submitRemoteSessionAction';

type TransferResult = Awaited<ReturnType<typeof sendPendingTransfer>>;

const describeTransfer = (result: TransferResult) => {
  if (typeof result === 'string') return result;
  if (result.status === 'sent') return `Sent to Portal · ${result.receipt.fileName}`;
  return 'message' in result ? result.message : 'The Portal could not verify the pairing.';
};

// Handles the Windows support panel: Stop sharing ends the Portal session, and
// dropped or browsed files are uploaded through the normal Portal transfer queue.
const useDesktopPanel = (
  device: PairedDevice,
  activeId: string | undefined,
  onAction: (id: string, action: RemoteSessionAction) => void,
  isRecording: boolean,
) => {
  const latest = useRef({ activeId, onAction });
  useLayoutEffect(() => {
    latest.current = { activeId, onAction };
  });

  // The on-top panel is the session banner in every Windows user.
  useEffect(() => {
    if (!desktopHost.isSupported || !activeId) return;
    const text = isRecording ? 'Remote session active · Recording' : 'Remote session active';
    desktopHost.notify(text);
    const timer = setInterval(() => desktopHost.notify(text), 15000); // Re-sent for a panel restarted after a user switch.
    return () => clearInterval(timer);
  }, [activeId, isRecording]);

  useEffect(() => {
    if (!desktopHost.isSupported) return;
    return desktopHost.onEvent(event => {
      if (event.event === 'stop') {
        recordSessionDiagnostic('remote:desktop', 'panel_stop');
        const id = latest.current.activeId;
        if (id) latest.current.onAction(id, 'end');
      }
      if (event.event === 'file-rejected') {
        desktopHost.notify(`${event.fileName} could not be prepared for upload.`);
      }
      if (event.event === 'file-staged') {
        desktopHost.notify(`Sending ${event.fileName}…`);
        sendPendingTransfer(device, event.transferId, () => undefined).then(
          result => desktopHost.notify(describeTransfer(result)),
          () => desktopHost.notify(`${event.fileName} could not be sent. Retry from the Files tab.`),
        );
      }
    });
  }, [device]);
};

export default useDesktopPanel;

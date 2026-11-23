/// <reference lib="dom" />
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import { LTSC_PICKER_ORIGIN, LTSC_PICKER_URL } from '../../native/ltscScreenPicker';
import getRemoteMediaConnection, { type RemoteMediaConnection } from '../../services/getRemoteMediaConnection';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import recordPeerSignal from './recordPeerSignal';
import type { ScreenPeerProps } from './ScreenPeer';
import useScreenPeerHeartbeat from './useScreenPeerHeartbeat';

const pickerStyle = { border: 0, width: '100%', height: 160 };

export const supportsDesktopControl = false;

const ConnectedScreenPeer = ({ deviceToken, sessionId }: ScreenPeerProps) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [connection, setConnection] = useState<RemoteMediaConnection>();
  const [failure, setFailure] = useState<string>();
  const hasUnconfirmedSession = useScreenPeerHeartbeat(deviceToken, sessionId);
  const canMountPicker = Boolean(connection && !failure && !hasUnconfirmedSession);

  const retry = () => {
    setConnection(undefined);
    setIsReady(false);
    setFailure(undefined);
    setAttempt(value => value + 1);
  };

  useEffect(() => {
    if (hasUnconfirmedSession) return;
    const controller = new AbortController();
    let stopped = false;
    const timeout = setTimeout(() => controller.abort(), 10000);
    recordSessionDiagnostic('remote:connection', 'request_started');
    getRemoteMediaConnection(deviceToken, sessionId, controller.signal, status => {
      recordSessionDiagnostic('remote:connection', `http_${status}`);
    }).then(value => {
      if (!stopped) setConnection(value);
    }).catch((error: unknown) => {
      if (!stopped) setFailure(error instanceof Error ? error.message : 'Could not prepare screen sharing.');
    }).finally(() => clearTimeout(timeout));
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt, deviceToken, hasUnconfirmedSession, sessionId]);

  useEffect(() => {
    if (hasUnconfirmedSession) {
      setConnection(undefined);
      setIsReady(false);
    }
  }, [hasUnconfirmedSession]);

  useLayoutEffect(() => {
    if (!canMountPicker || !connection) return;
    const picker = frame.current?.contentWindow;
    if (!picker) return;
    let enabled = false;
    const timeout = setTimeout(() => setFailure('The Windows screen picker did not start.'), 10000);
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== LTSC_PICKER_ORIGIN || event.source !== picker || typeof event.data !== 'string') return;
      if (event.data === 'screen-picker-page-loaded' && !enabled) {
        enabled = true;
        picker.postMessage({
          type: 'enable-picker',
          connection: { ...connection, controlAllowed: false },
        }, LTSC_PICKER_ORIGIN);
      } else if (event.data === 'screen-picker-ready' && enabled) {
        clearTimeout(timeout);
        setIsReady(true);
        recordSessionDiagnostic('remote:picker', 'ready');
      } else if (event.data === 'reconnect-screen-peer') {
        retry();
      } else {
        recordPeerSignal(event.data);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      picker.postMessage({ type: 'stop-picker' }, LTSC_PICKER_ORIGIN);
    };
  }, [canMountPicker, connection]);

  if (failure || hasUnconfirmedSession) {
    return (
      <View>
        <Text accessibilityLiveRegion="polite">
          {hasUnconfirmedSession ? 'The tablet could not confirm the remote session.' : failure}
        </Text>
        <ActionButton title="Retry screen sharing" disabled={hasUnconfirmedSession} onPress={retry} />
      </View>
    );
  }
  return (
    <View>
      {!isReady && <Text accessibilityLiveRegion="polite">Preparing screen sharing…</Text>}
      {canMountPicker && (
        <iframe key={attempt} ref={frame} src={LTSC_PICKER_URL} title="Windows screen sharing"
          allow="display-capture; microphone" style={pickerStyle} />
      )}
    </View>
  );
};

const ScreenPeer = (props: ScreenPeerProps) => props.isConnected
  ? <ConnectedScreenPeer {...props} />
  : <Text accessibilityLiveRegion="polite">Screen sharing stopped. Waiting for the tablet to reconnect…</Text>;

export default ScreenPeer;

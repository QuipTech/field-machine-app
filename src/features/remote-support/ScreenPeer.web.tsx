/// <reference lib="dom" />
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import { LTSC_PICKER_ORIGIN, LTSC_PICKER_URL } from '../../native/ltscScreenPicker';
import getRemoteMediaConnection, { type RemoteMediaConnection } from '../../services/getRemoteMediaConnection';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import handleScreenPickerMessage from './handleScreenPickerMessage';
import type { ScreenPeerProps } from './ScreenPeer';
import useDesktopControl from './useDesktopControl';
import useDesktopSource from './useDesktopSource';
import useScreenPeerHeartbeat from './useScreenPeerHeartbeat';

const pickerStyle = { border: 0, width: '100%', height: 160 };

export const supportsDesktopControl = true;

const ConnectedScreenPeer = ({ deviceToken, sessionId, canControl, transferPairing }: ScreenPeerProps) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [connection, setConnection] = useState<RemoteMediaConnection>();
  const [failure, setFailure] = useState<string>();
  const [selectedSurface, setSelectedSurface] = useState<'monitor' | 'window'>();
  const hasUnconfirmedSession = useScreenPeerHeartbeat(deviceToken, sessionId);
  const desktop = useDesktopSource({
    deviceToken, sessionId, transferPairing, frame, onFailure: setFailure,
    isReady: Boolean(connection && !failure && !hasUnconfirmedSession),
  });
  const canMountPicker = Boolean(connection && !failure && !hasUnconfirmedSession && desktop.isDesktop !== undefined);
  const isControlAllowed = canControl && connection?.controlAllowed === true;
  const owner = canMountPicker && selectedSurface === 'monitor' && isControlAllowed
    ? `${sessionId}:${attempt}` : undefined;
  const { isControlReady, onControlMessage } = useDesktopControl(owner);
  // Control updates must not rerun the picker effect, whose cleanup stops sharing.
  const control = useRef({ isControlAllowed, onControlMessage, desktop });
  useLayoutEffect(() => {
    control.current = { isControlAllowed, onControlMessage, desktop };
  });

  const retry = () => {
    setConnection(undefined);
    setIsReady(false);
    setSelectedSurface(undefined);
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
      setSelectedSurface(undefined);
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
      if (control.current.desktop.onPageMessage(event.data)) return;
      handleScreenPickerMessage(event.data, {
        onLoaded: () => {
          if (enabled) return;
          enabled = true;
          picker.postMessage({
            type: 'enable-picker',
            connection: {
              ...connection,
              controlAllowed: control.current.isControlAllowed,
              desktop: control.current.desktop.isDesktop === true,
            },
          }, LTSC_PICKER_ORIGIN);
        },
        setIsChoosingScreen: isChoosing => {
          if (!isChoosing || !enabled) return;
          clearTimeout(timeout);
          setIsReady(true);
        },
        setSelectedSurface,
        onControlMessage: message => control.current.onControlMessage(message),
        retry,
      });
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
      {desktop.isServiceMissing && (
        <Text accessibilityLiveRegion="polite">
          Sharing this Windows user only. Install FIELD Machine for all users to keep sharing and control after a user switch.
        </Text>
      )}
      {owner && (
        <Text accessibilityLiveRegion="polite">
          {isControlReady
            ? 'Remote control is on. Portal support can use the mouse and keyboard.'
            : 'Remote control unavailable. Check that one monitor is connected.'}
        </Text>
      )}
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

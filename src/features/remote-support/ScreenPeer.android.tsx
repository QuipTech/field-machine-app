import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { Switch, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../../components/workspaceStyles';
import getRemoteMediaConnection from '../../services/getRemoteMediaConnection';
import type { RemoteMediaConnection } from '../../services/getRemoteMediaConnection';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import captureScreen from './captureScreen.android';
import recordPeerSignal from './recordPeerSignal';
import RemoteInputSetup from './RemoteInputSetup';
import type { ScreenPeerProps } from './ScreenPeer';
import startScreenPeer from './startScreenPeer.android';
import useDesktopControl from './useDesktopControl';
import useRemoteInputAccess from './useRemoteInputAccess';
import useScreenPeerHeartbeat from './useScreenPeerHeartbeat';

type Phase = 'preparing' | 'ready' | 'capturing' | 'sharing';

const PREPARATION_TIMEOUT_MS = 10000;
const CONNECTION_INTERRUPTED = 'The tablet connection dropped. Retry screen sharing after it reconnects.';
const UNCONFIRMED = 'The tablet could not confirm the remote session. Screen sharing stopped.';

// Module-level so effects can call it without depending on a new closure.
const stopSharing = (peer: RefObject<(() => void) | undefined>) => {
  peer.current?.();
  peer.current = undefined;
};

const ScreenPeer = ({ sessionId, deviceToken, isConnected, canControl }: ScreenPeerProps) => {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [connection, setConnection] = useState<RemoteMediaConnection>();
  const [status, setStatus] = useState('Requesting Portal streaming credentials…');
  const [error, setError] = useState<string>();
  const [isMicrophoneShared, setIsMicrophoneShared] = useState(false);
  const stopPeer = useRef<() => void>(undefined);
  const currentAttempt = useRef(attempt);
  const hasUnconfirmedSession = useScreenPeerHeartbeat(deviceToken, sessionId);
  const { isEnabled: isInputEnabled } = useRemoteInputAccess();
  const isControlOffered = canControl && connection?.controlAllowed === true;
  const owner = phase === 'sharing' && isConnected && !error && isControlOffered && isInputEnabled
    ? `${sessionId}:${attempt}` : undefined;
  const { isControlReady, onControlMessage } = useDesktopControl(owner);
  const controlHandler = useRef(onControlMessage);


  useEffect(() => {
    controlHandler.current = onControlMessage;
  });
  useEffect(() => {
    currentAttempt.current = attempt;
  }, [attempt]);
  // Stop capture when the session ends (unmount), is unconfirmed, or the socket drops.
  useEffect(() => () => stopSharing(stopPeer), []);
  useEffect(() => {
    if (!hasUnconfirmedSession) return;
    stopSharing(stopPeer);
    recordSessionDiagnostic('remote:capture', 'stopped_session_unconfirmed');
    setError(UNCONFIRMED);
  }, [hasUnconfirmedSession]);
  useEffect(() => {
    if (isConnected || phase === 'preparing' || error) return;
    stopSharing(stopPeer);
    recordSessionDiagnostic('remote:capture', 'paused_socket_disconnected');
    setError(CONNECTION_INTERRUPTED);
  }, [isConnected, phase, error]);
  useEffect(() => {
    const controller = new AbortController();
    let isStopped = false;
    const timeout = setTimeout(() => controller.abort(), PREPARATION_TIMEOUT_MS);
    recordSessionDiagnostic('remote:connection', 'request_started');
    getRemoteMediaConnection(deviceToken, sessionId, controller.signal, httpStatus => {
      recordSessionDiagnostic('remote:connection', `http_${httpStatus}`);
    })
      .then(result => {
        if (isStopped) return;
        recordSessionDiagnostic('remote:connection', 'response_validated');
        setConnection(result);
        setPhase('ready');
        setStatus('Ready to share. Android will ask you to confirm before capture starts.');
      })
      .catch((failure: unknown) => {
        if (isStopped) return;
        recordSessionDiagnostic('remote:connection', 'preparation_failed');
        setError(failure instanceof Error ? failure.message : 'Could not prepare screen sharing.');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      isStopped = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [deviceToken, sessionId, attempt]);

  const share = async () => {
    if (!connection || phase !== 'ready') return;
    if (Date.parse(connection.expiresAt) <= Date.now()) {
      setError('Streaming credentials expired. Retry screen sharing.');
      return;
    }
    const shareAttempt = attempt;
    setPhase('capturing');
    setStatus('Confirm screen sharing in the Android dialog…');
    recordSessionDiagnostic('remote:capture', 'requested');
    try {
      const capture = await captureScreen(isMicrophoneShared);
      if (currentAttempt.current !== shareAttempt) {
        capture.getTracks().forEach(track => track.stop());
        return;
      }
      recordSessionDiagnostic('remote:capture', 'started');
      stopPeer.current = startScreenPeer(
        { ...connection, controlAllowed: canControl && connection.controlAllowed },
        capture,
        {
          onSignal: recordPeerSignal,
          onStatus: setStatus,
          onControlMessage: message => controlHandler.current(message),
          onStop: message => {
            stopPeer.current = undefined;
            setError(message);
          },
        },
      );
      setPhase('sharing');
      setStatus('Waiting for the Portal viewer.');
    } catch (failure) {
      if (currentAttempt.current !== shareAttempt) return;
      recordSessionDiagnostic('remote:capture', 'not_started');
      setPhase('ready');
      setStatus(failure instanceof Error ? failure.message : 'Android could not start screen capture.');
    }
  };
  const retry = () => {
    if (!isConnected || hasUnconfirmedSession) return;
    stopSharing(stopPeer);
    setConnection(undefined);
    setError(undefined);
    setPhase('preparing');
    setStatus('Requesting Portal streaming credentials…');
    setAttempt(value => value + 1);
  };

  if (error) {
    return (
      <View style={styles.card}>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{isConnected ? error : CONNECTION_INTERRUPTED}</Text>
        {isConnected && <ActionButton title="Retry screen sharing" disabled={hasUnconfirmedSession} onPress={retry} />}
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
      {phase === 'ready' && (
        <>
          <View style={styles.row}>
            <ActionButton title="Share screen" onPress={() => { share(); }} />
          </View>
          <View style={styles.row}>
            <Switch
              accessibilityLabel="Share microphone audio"
              value={isMicrophoneShared}
              onValueChange={setIsMicrophoneShared}
            />
            <Text style={styles.body}>Share microphone audio</Text>
          </View>
        </>
      )}
      {phase === 'sharing' && (
        <View style={styles.row}>
          <ActionButton title="Stop sharing" variant="danger" onPress={retry} />
        </View>
      )}
      {isControlOffered && isInputEnabled === false && <RemoteInputSetup />}
      {owner && (
        <Text style={styles.body}>
          {isControlReady ? 'Portal support can control this tablet.' : 'Remote control is unavailable on this tablet.'}
        </Text>
      )}
    </View>
  );
};

export default ScreenPeer;

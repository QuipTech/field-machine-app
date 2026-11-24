import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import ActionButton from '../../components/ActionButton';
import openScreenPickerOrigin from '../../native/openScreenPickerOrigin.windows';
import getRemoteMediaConnection from '../../services/getRemoteMediaConnection';
import type { RemoteMediaConnection } from '../../services/getRemoteMediaConnection';
import requestStreamingResponse from '../../services/requestStreamingResponse.windows';
import useScreenPeerHeartbeat from './useScreenPeerHeartbeat';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import type { ScreenPeerProps } from './ScreenPeer';
import screenPeerPage from './screenPeerPage';
import useDesktopControl from './useDesktopControl';
import handleScreenPickerMessage from './handleScreenPickerMessage';

const styles = StyleSheet.create({
  peerContainer: { height: 165, flex: 0 },
  expandedPicker: { height: 480 },
});

const CONNECTION_INTERRUPTED = 'The tablet connection dropped. Retry screen sharing after it reconnects.';

export const supportsDesktopControl = true;

const ScreenPeer = ({ sessionId, deviceToken, isConnected, canControl }: ScreenPeerProps) => {
  const webView = useRef<WebView>(null);
  const injectedUrl = useRef<string>(undefined);
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [isChoosingScreen, setIsChoosingScreen] = useState(false);
  const [selectedSurface, setSelectedSurface] = useState<'monitor' | 'window'>();
  const [page, setPage] = useState<{ url: string; connection: RemoteMediaConnection }>();
  const [preparationError, setError] = useState<string>();
  const hasUnconfirmedSession = useScreenPeerHeartbeat(deviceToken, sessionId);
  const error = hasUnconfirmedSession
    ? 'The tablet could not confirm the remote session. Screen sharing stopped.'
    : preparationError;
  const [attempt, setAttempt] = useState(0);
  const [preparation, setPreparation] = useState('Requesting Portal streaming credentials…');
  const owner = selectedSurface === 'monitor' && page && isConnected && !error && canControl && page.connection.controlAllowed
    ? `${sessionId}:${page.url}:${attempt}` : undefined;
  const { isControlReady, onControlMessage } = useDesktopControl(owner);
  useEffect(() => {
    if (hasUnconfirmedSession) {
      setPage(undefined);
      setError('The tablet could not confirm the remote session. Retry screen sharing once it is active.');
    }
  }, [hasUnconfirmedSession]);
  const retry = () => {
    if (!isConnected || hasUnconfirmedSession) {
      return;
    }
    setPage(undefined);
    setError(undefined);
    setPreparation('Requesting Portal streaming credentials…');
    setLoadedUrl(undefined);
    setIsChoosingScreen(false);
    setSelectedSurface(undefined);
    injectedUrl.current = undefined;
    setAttempt(value => value + 1);
  };
  useEffect(() => {
    if (!page || error) {
      return;
    }
    if (!isConnected && injectedUrl.current === page.url) {
      setPage(undefined);
      setError(CONNECTION_INTERRUPTED);
      recordSessionDiagnostic('remote:connection', 'paused_socket_disconnected');
    } else if (isConnected && loadedUrl === page.url && injectedUrl.current !== page.url && webView.current) {
      injectedUrl.current = page.url;
      recordSessionDiagnostic('remote:picker', 'bootstrap_dispatched');
      webView.current.injectJavaScript(
        `if (location.href === ${JSON.stringify(page.url)}) window.enableFieldScreenPicker?.(${JSON.stringify({
          ...page.connection, controlAllowed: canControl && page.connection.controlAllowed,
        })}); true;`,
      );
    }
  }, [canControl, error, isConnected, loadedUrl, page]);
  useEffect(() => {
    if (!isConnected || !page || error || loadedUrl === page.url) {
      return;
    }
    const timeout = setTimeout(() => {
      recordSessionDiagnostic('remote:picker', 'webview_ready_timeout');
      setError('The local screen picker page did not finish loading.');
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isConnected, page, error, loadedUrl]);
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let settled = false;
    let stage: 'connection' | 'picker' = 'connection';
    recordSessionDiagnostic('remote:connection', 'request_started');
    const timeout = setTimeout(() => {
      stopped = true;
      settled = true;
      controller.abort();
      recordSessionDiagnostic(`remote:${stage}`, 'preparation_timeout');
      setError(stage === 'connection'
        ? 'The streaming connection API did not finish responding.'
        : 'Windows did not finish starting the local screen picker.');
    }, 10000);
    const startedAt = Date.now();
    getRemoteMediaConnection(deviceToken, sessionId, controller.signal, status => {
      recordSessionDiagnostic('remote:connection', `http_${status}`);
    }, requestStreamingResponse, (step, elapsed) => {
      recordSessionDiagnostic('remote:connection', `${step}_after_${elapsed}_ms`);
    })
      .then(async connection => {
        if (stopped) {
          return;
        }
        const elapsed = Date.now() - startedAt;
        recordSessionDiagnostic('remote:connection', `validated_after_${elapsed}_ms`);
        if (elapsed >= 10000) {
          throw new Error('The streaming credentials arrived after the preparation deadline. Retry screen sharing.');
        }
        recordSessionDiagnostic('remote:connection', 'response_validated');
        stage = 'picker';
        setPreparation('Starting the Windows screen picker…');
        recordSessionDiagnostic('remote:picker', 'opening_local_origin');
        const url = await openScreenPickerOrigin(screenPeerPage);
        if (!stopped) {
          recordSessionDiagnostic('remote:picker', 'local_origin_ready');
          setPage({ url, connection });
        }
      })
      .catch((failure: unknown) => {
        if (!stopped) {
          recordSessionDiagnostic(`remote:${stage}`, 'preparation_failed');
          setError(failure instanceof Error ? failure.message : 'Could not prepare the screen picker.');
        }
      })
      .finally(() => {
        settled = true;
        clearTimeout(timeout);
      });
    return () => {
      stopped = true;
      if (!settled) {
        recordSessionDiagnostic(`remote:${stage}`, 'preparation_cancelled');
      }
      clearTimeout(timeout);
      controller.abort();
    };
  }, [deviceToken, sessionId, attempt]);

  if (error || !page || (!isConnected && injectedUrl.current === page.url)) {
    return (
      <View>
        <Text accessibilityLiveRegion="polite">
          {isConnected ? error ?? preparation : CONNECTION_INTERRUPTED}
        </Text>
        {isConnected && error && <ActionButton title="Retry screen sharing" disabled={hasUnconfirmedSession} onPress={retry} />}
      </View>
    );
  }
  return (
    <View>
      {owner && !isControlReady && <Text>Remote control unavailable. Check that one monitor is connected.</Text>}
      {loadedUrl !== page.url && (
        <Text accessibilityLiveRegion="polite">
          {isConnected ? 'Loading the local picker page…' : 'Waiting for the tablet to reconnect…'}
        </Text>
      )}
      <WebView
        containerStyle={[styles.peerContainer, isChoosingScreen && styles.expandedPicker]}
        ref={webView}
        originWhitelist={['about:blank', 'http://127.0.0.1:*']}
        source={{ html: `<!doctype html><script>location.replace(${JSON.stringify(page.url)});</script>` }}
        onLoadStart={() => recordSessionDiagnostic('remote:picker', 'navigation_started')}
        onLoad={event => {
          if (event.nativeEvent.url === page.url && loadedUrl !== page.url) {
            recordSessionDiagnostic('remote:picker', 'navigation_completed');
            setLoadedUrl(page.url);
          }
        }}
        onMessage={event => {
          if (event.nativeEvent.url !== page.url) {
            return;
          }
          handleScreenPickerMessage(event.nativeEvent.data, {
            setIsChoosingScreen, setSelectedSurface, onLoaded: () => setLoadedUrl(page.url),
            onControlMessage, retry,
          });
        }}
        onError={() => {
          recordSessionDiagnostic('remote:picker', 'webview_load_failed');
          setError('Windows WebView could not load the local screen picker.');
        }}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === page.url}
      />
    </View>
  );
};

export default ScreenPeer;


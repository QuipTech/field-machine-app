import { useEffect, useRef, useState } from 'react';
import subscribeToAppResume from '../../native/subscribeToAppResume';
import submitRemoteSessionAction, { type RemoteSessionAction } from '../../services/submitRemoteSessionAction';
import type { PairedDevice } from '../pairing/pairingSchema';
import useConnectionStore from '../connection/useConnectionStore';
import recordSessionDiagnostic from '../connection/sessionDiagnostics';
import describeRemoteCheck from './describeRemoteCheck';
import getCurrentRemoteSession, { type RemoteRequest } from '../../services/getCurrentRemoteSession';

const useRemoteRequest = (device: PairedDevice, isPaired: boolean) => {
  const { deviceId, deviceToken, machine: { id: machineId } } = device;
  const [activeSession, setActiveSession] = useState<RemoteRequest>();
  const [approvedId, setApprovedId] = useState<string>();
  const [controlConsentId, setControlConsentId] = useState<string>();
  const [request, setRequest] = useState<RemoteRequest>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [checkError, setCheckError] = useState<string>();
  const submitAction = useRef<(id: string, action: RemoteSessionAction) => void>(() => undefined);
  useEffect(() => {
    setActiveSession(undefined);
    setApprovedId(undefined);
    setControlConsentId(undefined);
    setRequest(undefined);
    setError(undefined);
    setCheckError(undefined);
    setIsSubmitting(false);
    if (!isPaired) {
      return;
    }
    let stopped = false;
    let next: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let decision: AbortController | undefined;
    let pendingId: string | undefined;
    let currentActiveId: string | undefined;
    let resolvedId: string | undefined;
    let lastDetail: string | undefined;
    const poll = async () => {
      if (stopped || decision || controller) {
        return;
      }
      clearTimeout(next);
      controller = new AbortController();
      const current = controller;
      const timeout = setTimeout(() => current.abort(), 8000);
      try {
        const { session, isUnavailable, serverTime } = await getCurrentRemoteSession(deviceToken, controller.signal);
        if (stopped || controller !== current) {
          return;
        }
        clearTimeout(expiry);
        const isWrongPairing = session !== null &&
          (session.deviceId !== deviceId || session.machineId !== machineId);
        const check = describeRemoteCheck(
          { session, isUnavailable, isWrongPairing, serverTime }, Date.now());
        setCheckError(check.message);
        if (check.detail !== lastDetail) {
          lastDetail = check.detail;
          recordSessionDiagnostic('remote:check', check.detail);
        }
        const active = session?.status === 'active' && !isWrongPairing ? session : undefined;
        currentActiveId = active?.id;
        setActiveSession(active);
        if (session?.status !== 'active' && session?.status !== 'requested') {
          setApprovedId(undefined);
          setControlConsentId(undefined);
        }
        const remaining = session ? Date.parse(session.expiresAt) - Date.now() : 0;
        if (session?.status === 'requested' && session.initiatedBy === 'portal' &&
            session.id !== resolvedId && remaining > 0 &&
            !isWrongPairing) {
          pendingId = session.id;
          setRequest(session);
          expiry = setTimeout(() => {
            pendingId = undefined;
            setRequest(undefined);
          }, Math.min(remaining, 2147483647));
        } else {
          pendingId = undefined;
          setRequest(undefined);
        }
      } catch (failure) {
        if (!stopped && controller === current) {
          if (lastDetail !== 'check_failed') {
            lastDetail = 'check_failed';
            recordSessionDiagnostic('remote:check', lastDetail);
          }
          pendingId = undefined;
          currentActiveId = undefined;
          setActiveSession(undefined);
          setRequest(undefined);
          setCheckError(failure instanceof Error && failure.name === 'ZodError'
            ? 'The API returned an unexpected remote session response.'
            : 'Could not check for remote support requests. Retrying.');
        }
      } finally {
        clearTimeout(timeout);
        if (controller === current) {
          controller = undefined;
        }
      }
      if (!stopped && !decision && !controller) {
        clearTimeout(next);
        next = setTimeout(poll, 10000);
      }
    };
    const submit = async (id: string, action: RemoteSessionAction) => {
      if (stopped || decision || (action === 'end' ? currentActiveId !== id : pendingId !== id)) {
        return;
      }
      clearTimeout(next);
      const current = new AbortController();
      decision = current;
      controller?.abort();
      controller = undefined;
      const timeout = setTimeout(() => current.abort(), 8000);
      setIsSubmitting(true);
      if (action === 'end') {
        setApprovedId(undefined);
        setControlConsentId(undefined);
      }
      setError(undefined);
      try {
        await submitRemoteSessionAction(deviceToken, id, action, current.signal);
        if (!stopped) {
          resolvedId = id;
          if (action === 'end') {
            currentActiveId = undefined;
            setActiveSession(undefined);
          } else {
            if (action.decision === 'allow') {
              setApprovedId(id);
              setControlConsentId(action.allowControl ? id : undefined);
            }
            pendingId = undefined;
            setRequest(undefined);
          }
        }
      } catch {
        if (!stopped) {
          setError('Could not confirm the session action. Checking the latest status.');
        }
      } finally {
        clearTimeout(timeout);
        decision = undefined;
        if (!stopped) {
          setIsSubmitting(false);
          poll();
        }
      }
    };
    submitAction.current = submit;
    const unsubscribe = subscribeToAppResume(poll);
    const unsubscribeSocket = useConnectionStore.subscribe((state, previous) => {
      if (state.remoteSessionRevision !== previous.remoteSessionRevision) {
        poll();
      }
    });
    poll();
    return () => {
      stopped = true;
      controller?.abort();
      decision?.abort();
      unsubscribe();
      unsubscribeSocket();
      submitAction.current = () => undefined;
      clearTimeout(next);
      clearTimeout(expiry);
    };
  }, [deviceId, deviceToken, machineId, isPaired]);
  return {
    request: isPaired ? request : undefined,
    checkError: isPaired ? checkError : undefined,
    activeId: isPaired ? activeSession?.id : undefined,
    isRecordingExpected: isPaired && activeSession?.scope.record === true,
    recordingStatus: isPaired ? activeSession?.recording?.status : undefined,
    // Unattended sessions were authorised with the tablet password in the Portal: stream at once.
    approvedId: isPaired ? (activeSession?.access === 'unattended' ? activeSession.id : approvedId) : undefined,
    canControl: isPaired && activeSession?.scope.control === true &&
      (activeSession.access === 'unattended' || activeSession.id === controlConsentId),
    isControlRequested: isPaired && activeSession?.scope.control === true,
    // Local consent lives only in memory. After an app restart, or when a session became
    // active without this tablet's prompt, the operator must approve sharing here again.
    onResume: (allowControl: boolean) => {
      if (!isPaired || !activeSession) return;
      setApprovedId(activeSession.id);
      setControlConsentId(allowControl && activeSession.scope.control ? activeSession.id : undefined);
    },
    isSubmitting,
    error,
    onAction: (id: string, action: RemoteSessionAction) => submitAction.current(id, action),
  };
};

export default useRemoteRequest;



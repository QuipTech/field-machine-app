import recordSessionDiagnostic from '../connection/sessionDiagnostics';

const SIGNAL_EVENTS = new Set([
  'signaling_open', 'sdp_offer_received', 'sdp_answer_sent', 'signaling_closed',
  'negotiation_failed', 'ice_candidate_rejected', 'signaling_frame_ignored',
  'peer_connecting', 'peer_connected', 'peer_disconnected', 'peer_failed',
  'capture_ended', 'capture_muted', 'capture_unmuted',
]);

const recordPeerSignal = (event: string) => {
  if (SIGNAL_EVENTS.has(event)) recordSessionDiagnostic('remote:signaling', event);
};

export default recordPeerSignal;

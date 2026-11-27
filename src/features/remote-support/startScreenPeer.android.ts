import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from 'react-native-webrtc';
import type { RemoteMediaConnection } from '../../services/getRemoteMediaConnection';
import signalingMessages, { type SignalingCandidate, type SignalingOffer } from './signalingMessages';
import startScreenVideo from './startScreenVideo.android';

export interface ScreenPeerCallbacks {
  onSignal: (event: string) => void;
  onStatus: (status: string) => void;
  onControlMessage: (message: string) => void;
  onStop: (message: string) => void;
}

const MAX_QUEUED_ICE = 128;
const MAX_CONTROL_MESSAGE = 8192;
const RECONNECT_GRACE_MS = 30000;

/**
 * Android counterpart of the Windows WebView peer (screenPeerPage.ts and its
 * signaling, ICE, and control fragments). Those run as page script inside
 * the WebView, so this module mirrors the same rules with react-native-webrtc:
 * answer only the designated viewer, queue ICE until the answer, resend the
 * answer for a repeated offer, forward the ordered "control" channel when
 * control is allowed, and stop capture on GO_AWAY, signaling close, or
 * viewer loss. Returns a function that stops everything without onStop.
 */
const startScreenPeer = (
  connection: RemoteMediaConnection,
  capture: MediaStream,
  callbacks: ScreenPeerCallbacks,
) => {
  const track = capture.getVideoTracks()[0];
  // react-native-webrtc rewrites the server objects it receives, so pass copies.
  const peer = new RTCPeerConnection({
    iceServers: connection.iceServers.map(server => ({ ...server, urls: [...server.urls] })),
  });
  const socket = new WebSocket(connection.signalingUrl);
  const pendingIce: SignalingCandidate[] = [];
  const outboundIce: ReturnType<RTCIceCandidate['toJSON']>[] = [];
  let answeredOffer: string | undefined;
  let controlChannel: unknown;
  let recovery: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  const shutdown = () => {
    if (isStopped) return;
    isStopped = true;
    clearTimeout(recovery);
    controlChannel = undefined;
    callbacks.onControlMessage('control-release');
    peer.close();
    socket.close();
    capture.getTracks().forEach(item => item.stop());
  };
  const fail = (message: string) => {
    if (isStopped) return;
    shutdown();
    callbacks.onStop(message);
  };
  const send = (action: 'SDP_ANSWER' | 'ICE_CANDIDATE', payload: unknown) => {
    if (isStopped || socket.readyState !== WebSocket.OPEN) return;
    socket.send(signalingMessages.createMessage(action, connection.viewerClientId, payload));
    if (action === 'SDP_ANSWER') callbacks.onSignal('sdp_answer_sent');
  };
  const addIce = async (candidate: SignalingCandidate) => {
    try {
      await peer.addIceCandidate(new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      }));
    } catch {
      callbacks.onSignal('ice_candidate_rejected');
    }
  };
  const answer = async (offer: SignalingOffer) => {
    callbacks.onSignal('sdp_offer_received');
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const transceivers = peer.getTransceivers();
    const video = transceivers.find(item => item.receiver.track?.kind === 'video');
    if (!video || !track) throw new Error('The viewer did not offer a video track.');
    await video.sender.replaceTrack(track);
    video.direction = 'sendonly';
    const audio = transceivers.find(item => item.receiver.track?.kind === 'audio');
    if (audio) {
      const microphone = capture.getAudioTracks()[0];
      if (microphone) await audio.sender.replaceTrack(microphone);
      // Support audio from the viewer plays through the tablet speaker.
      audio.direction = microphone ? 'sendrecv' : 'recvonly';
    }
    for (const candidate of pendingIce.splice(0)) await addIce(candidate);
    await peer.setLocalDescription(await peer.createAnswer());
    send('SDP_ANSWER', peer.localDescription?.toJSON());
    answeredOffer = offer.sdp;
    for (const candidate of outboundIce.splice(0)) send('ICE_CANDIDATE', candidate);
  };
  const handleFrame = async (data: unknown) => {
    const frame = signalingMessages.readFrame(data);
    if (!frame) {
      callbacks.onSignal('signaling_frame_ignored');
      return;
    }
    if (frame.messageType === 'GO_AWAY') {
      fail('Signaling expired.');
      return;
    }
    const payload = frame.messagePayload;
    if (frame.senderClientId !== connection.viewerClientId || payload === undefined) return;
    if (frame.messageType === 'SDP_OFFER') {
      const offer = signalingMessages.readOffer(payload);
      if (!offer) {
        callbacks.onSignal('signaling_frame_ignored');
      } else if (!answeredOffer) {
        await answer(offer);
      } else if (offer.sdp === answeredOffer && peer.localDescription) {
        send('SDP_ANSWER', peer.localDescription.toJSON());
      }
    } else if (frame.messageType === 'ICE_CANDIDATE') {
      const candidate = signalingMessages.readCandidate(payload);
      if (!candidate) callbacks.onSignal('ice_candidate_rejected');
      else if (peer.remoteDescription) await addIce(candidate);
      else if (pendingIce.length < MAX_QUEUED_ICE) pendingIce.push(candidate);
    }
  };

  let messages = Promise.resolve();
  socket.onmessage = event => {
    messages = messages.then(() => (isStopped ? undefined : handleFrame(event.data))).catch(() => {
      if (isStopped) return;
      if (answeredOffer) {
        callbacks.onSignal('signaling_frame_ignored');
        return;
      }
      callbacks.onSignal('negotiation_failed');
      fail('The Portal viewer could not connect.');
    });
  };
  socket.onopen = () => {
    callbacks.onStatus('Waiting for the Portal viewer.');
    callbacks.onSignal('signaling_open');
  };
  socket.onclose = () => {
    if (isStopped) return;
    callbacks.onSignal('signaling_closed');
    fail('Signaling closed.');
  };
  peer.addEventListener('icecandidate', event => {
    if (!event.candidate) return;
    const candidate = event.candidate.toJSON();
    if (answeredOffer) send('ICE_CANDIDATE', candidate);
    else if (outboundIce.length < MAX_QUEUED_ICE) outboundIce.push(candidate);
  });
  peer.addEventListener('datachannel', event => {
    const channel = event.channel;
    if (!connection.controlAllowed || channel.label !== 'control' || !channel.ordered || controlChannel) return;
    controlChannel = channel;
    channel.addEventListener('message', message => {
      if (isStopped || peer.connectionState !== 'connected' || track?.readyState !== 'live' ||
          track.muted || channel.readyState !== 'open' || typeof message.data !== 'string' ||
          message.data.length > MAX_CONTROL_MESSAGE) return;
      // useDesktopControl validates the JSON against remoteInputSchema.
      callbacks.onControlMessage(`control:${message.data}`);
    });
    const release = () => {
      if (controlChannel !== channel) return;
      controlChannel = undefined;
      callbacks.onControlMessage('control-release');
    };
    channel.addEventListener('close', release);
    channel.addEventListener('error', release);
  });
  peer.addEventListener('connectionstatechange', () => {
    if (isStopped) return;
    clearTimeout(recovery);
    const state = peer.connectionState;
    callbacks.onSignal(`peer_${state}`);
    if (state === 'connected') {
      if (track) startScreenVideo(peer, track);
      callbacks.onStatus('Sharing screen.');
    } else if (state === 'disconnected') {
      callbacks.onControlMessage('control-release');
      if (track) track.enabled = false;
      callbacks.onStatus('Viewer connection interrupted. Waiting to reconnect…');
      recovery = setTimeout(() => fail('The viewer did not reconnect.'), RECONNECT_GRACE_MS);
    } else if (state === 'failed') {
      fail('Viewer connection lost.');
    }
  });
  track?.addEventListener('ended', () => {
    callbacks.onSignal('capture_ended');
    fail('Android ended screen capture. Share the screen again to continue.');
  });
  return shutdown;
};

export default startScreenPeer;

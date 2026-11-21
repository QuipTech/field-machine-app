import screenPeerStyles from './screenPeerStyles';
import screenPeerIce from './screenPeerIce';
import screenPeerSignaling from './screenPeerSignaling';
import screenPeerControl from './screenPeerControl';

const screenPeerPage = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src wss://*.kinesisvideo.ap-southeast-2.amazonaws.com">
${screenPeerStyles}
</head><body><button id="share" disabled>Choose screen to share</button>
<label><input id="microphone" type="checkbox">Share microphone audio</label>
<audio id="support-audio" autoplay controls></audio>
<button id="retry" hidden>Reconnect screen sharing</button>
<p id="status" role="status">Share a window for viewing only, or an entire screen for remote control when approved.</p>
<script>
let config;
const share = document.getElementById('share');
const status = document.getElementById('status');
const supportAudio = document.getElementById('support-audio');
const retry = document.getElementById('retry');
const microphone = document.getElementById('microphone');
window.enableFieldScreenPicker = credentials => {
  config = credentials;
  share.disabled = false;
  window.chrome.webview.postMessage('screen-picker-ready');
};
retry.onclick = () => window.chrome.webview.postMessage('reconnect-screen-peer');
let stream;
let socket;
let peer;
let generation = 0;
const stop = message => {
  generation++;
  if (peer) peer.close();
  if (socket) socket.close();
  if (stream) stream.getTracks().forEach(track => track.stop());
  supportAudio.srcObject = null;
  peer = socket = stream = undefined;
  window.chrome?.webview?.postMessage('control-release');
  if (message) {
    status.textContent = message;
    retry.hidden = false;
  }
};
window.addEventListener('pagehide', () => stop());
const encode = value => btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)),
  byte => String.fromCharCode(byte)).join(''));
const decode = value => JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(value), byte => byte.charCodeAt(0))));
share.onclick = async () => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
    status.textContent = 'The Windows WebView runtime does not expose a screen picker.';
    return;
  }
  share.disabled = true;
  retry.hidden = true;
  const attempt = ++generation;
  try {
    const capture = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { max: 1920 },
        height: { max: 1080 }, frameRate: { max: 15 } },
      audio: false
    });
    if (attempt !== generation) {
      capture.getTracks().forEach(track => track.stop());
      return;
    }
    stream = capture;
    const track = capture.getVideoTracks()[0];
    const surface = track.getSettings().displaySurface;
    if (surface !== 'monitor' && surface !== 'window') {
      stop('Select a window or an entire screen to continue.');
      share.disabled = false;
      return;
    }
    if (Date.parse(config.expiresAt) <= Date.now()) {
      stop('Streaming credentials expired.');
      return;
    }
    track.onended = () => {
      window.chrome.webview.postMessage('capture_ended');
      stop('Windows ended screen capture. Reconnect and select the screen again.');
    };
    track.onmute = () => {
      window.chrome.webview.postMessage('control-release');
      window.chrome.webview.postMessage('capture_muted');
    };
    track.onunmute = () => window.chrome.webview.postMessage('capture_unmuted');
    window.chrome.webview.postMessage('screen-picker-selected-' + surface);
    if (microphone.checked) {
      try {
        const audioCapture = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (attempt !== generation) {
          audioCapture.getTracks().forEach(audioTrack => audioTrack.stop());
          return;
        }
        audioCapture.getAudioTracks().forEach(audioTrack => capture.addTrack(audioTrack));
      } catch {
        if (attempt === generation) {
          stop('Windows could not access the microphone. Reconnect and leave microphone sharing off to share video only.');
        }
        return;
      }
    }
    peer = new RTCPeerConnection({ iceServers: config.iceServers });
    const currentPeer = peer;
    ${screenPeerControl}
    currentPeer.ontrack = event => {
      if (attempt === generation && event.track.kind === 'audio') {
        supportAudio.srcObject = new MediaStream([event.track]);
        supportAudio.play().catch(() => {});
      }
    };
    socket = new WebSocket(config.signalingUrl);
    const currentSocket = socket;
    const send = (action, payload) => {
      if (attempt === generation && currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.send(JSON.stringify({ action, recipientClientId: config.viewerClientId,
          messagePayload: encode(payload) }));
        if (action === 'SDP_ANSWER') window.chrome.webview.postMessage('sdp_answer_sent');
      }
    };
    const pendingIce = [];
    ${screenPeerIce}
    ${screenPeerSignaling}
    currentPeer.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (answeredOffer) send('ICE_CANDIDATE', candidate);
      else if (outboundIce.length < 128) outboundIce.push(candidate);
    };
    let recoveryTimeout;
    currentPeer.onconnectionstatechange = () => {
      if (attempt !== generation) return;
      clearTimeout(recoveryTimeout);
      const state = currentPeer.connectionState;
      window.chrome.webview.postMessage('peer_' + state);
      if (state === 'connected') {
        track.enabled = true;
        status.textContent = surface === 'window' ? 'Sharing one window · View only' : 'Sharing screen.';
      }
      if (state === 'disconnected') {
        window.chrome.webview.postMessage('control-release');
        track.enabled = false;
        status.textContent = 'Viewer connection interrupted. Waiting to reconnect…';
        recoveryTimeout = setTimeout(() => {
          if (attempt === generation) stop('The viewer did not reconnect.');
        }, 5000);
      }
      if (state === 'failed') {
        stop('Viewer connection lost.');
      }
    };
    currentSocket.onopen = () => {
      status.textContent = 'Waiting for the Portal viewer.';
      window.chrome.webview.postMessage('signaling_open');
    };
    currentSocket.onclose = () => {
      if (attempt === generation) {
        window.chrome.webview.postMessage('signaling_closed');
        stop('Signaling closed.');
      }
    };
  } catch {
    if (attempt === generation) {
      stop('Windows could not share the screen. Check the screen picker and try again.');
      share.disabled = false;
    }
  }
};
window.chrome.webview.postMessage('screen-picker-page-loaded');
</script></body></html>`;

export default screenPeerPage;

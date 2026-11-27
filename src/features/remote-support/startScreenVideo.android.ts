import type { MediaStreamTrack, RTCPeerConnection } from 'react-native-webrtc';

// A tablet cannot encode large screens at 30 fps smoothly; fewer frames keep
// each one on time and are enough for support work.
const MAX_FRAME_RATE = 15;

const startScreenVideo = (peer: RTCPeerConnection, track: MediaStreamTrack) => {
  track.enabled = true;
  const sender = peer.getSenders().find(item => item.track?.kind === 'video');
  if (!sender) return;
  const parameters = sender.getParameters();
  parameters.encodings.forEach(encoding => { encoding.maxFramerate = MAX_FRAME_RATE; });
  // Streaming continues with the defaults if the limit is refused.
  sender.setParameters(parameters).catch(() => undefined);
};

export default startScreenVideo;

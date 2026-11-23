import { Dimensions, PermissionsAndroid, Platform } from 'react-native';
import { mediaDevices, type MediaStream } from 'react-native-webrtc';

// Matches the Windows page's 1920 px video cap; the tablet encodes less.
const MAX_LONG_SIDE = 1920;
const NOTIFICATIONS_API_LEVEL = 33;

const stopStream = (stream: MediaStream) => stream.getTracks().forEach(track => track.stop());

// Android shows the capture notification only with this permission (API 33+).
// Capture still works if the operator declines it.
const requestNotificationPermission = async () => {
  if (typeof Platform.Version !== 'number' || Platform.Version < NOTIFICATIONS_API_LEVEL) return;
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => undefined);
};

const addMicrophone = async (stream: MediaStream) => {
  const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
    .catch(() => PermissionsAndroid.RESULTS.DENIED);
  if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Microphone permission was not granted. Turn microphone sharing off to share video only.');
  }
  const audio = await mediaDevices.getUserMedia({ audio: true }).catch(() => {
    throw new Error('Android could not access the microphone. Turn microphone sharing off to share video only.');
  });
  audio.getAudioTracks().forEach(track => stream.addTrack(track));
};

/**
 * Starts whole-screen capture through react-native-webrtc's MediaProjection
 * support. Android shows its own consent dialog first; react-native-webrtc
 * then starts its mediaProjection foreground service (enabled natively in
 * RemoteSupportPackage). On Android 14+ the dialog is limited to the entire
 * screen so Portal control coordinates map to the whole display.
 */
const captureScreen = async (isMicrophoneShared: boolean) => {
  await requestNotificationPermission();
  const { width, height, scale } = Dimensions.get('screen');
  const longSide = Math.max(width, height) * scale;
  const resolutionScale = longSide > 0 ? Math.min(1, MAX_LONG_SIDE / longSide) : 1;
  const stream = await mediaDevices.getDisplayMedia({
    android: { createConfigForDefaultDisplay: true, resolutionScale },
  }).catch((failure: unknown) => {
    const isDeclined = typeof failure === 'object' && failure !== null &&
      'message' in failure && failure.message === 'NotAllowedError';
    throw new Error(isDeclined
      ? 'Screen sharing was not allowed. Tap Share screen to try again.'
      : 'Android could not start screen capture. Tap Share screen to try again.');
  });
  if (!isMicrophoneShared) return stream;
  try {
    await addMicrophone(stream);
  } catch (failure) {
    stopStream(stream);
    throw failure;
  }
  return stream;
};

export default captureScreen;

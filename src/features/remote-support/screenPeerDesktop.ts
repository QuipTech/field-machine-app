// Page script for whole-desktop sharing through the FIELD Machine Desktop
// service. The service sends JPEG frames of whichever Windows user is on screen;
// they are painted on a canvas whose stream replaces the screen picker.
const screenPeerDesktop = `
let desktopCanvas;
let desktopTrack;
let desktopMicrophone;
let latestFrame;
let isDrawing = false;
window.startFieldDesktopCapture = () => {
  desktopCanvas = document.createElement('canvas');
  desktopCanvas.width = 1280;
  desktopCanvas.height = 720;
  desktopCanvas.getContext('2d').fillRect(0, 0, 1280, 720);
  // captureStream(0) emits a frame only when requestFrame() follows a drawing.
  const capture = desktopCanvas.captureStream(0);
  desktopTrack = capture.getVideoTracks()[0];
  desktopTrack.contentHint = 'detail';
  desktopTrack.requestFrame();
  return capture;
};
const drawLatestFrame = async () => {
  if (isDrawing || !latestFrame || !desktopCanvas) return;
  isDrawing = true;
  const data = latestFrame;
  latestFrame = undefined;
  try {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    if (desktopCanvas) {
      if (desktopCanvas.width !== image.width || desktopCanvas.height !== image.height) {
        desktopCanvas.width = image.width;
        desktopCanvas.height = image.height;
      }
      desktopCanvas.getContext('2d').drawImage(image, 0, 0);
      desktopTrack?.requestFrame();
    }
    image.close();
  } catch {
    // Skip a damaged frame; the next one replaces it.
  }
  isDrawing = false;
  drawLatestFrame();
};
window.drawFieldDesktopFrame = data => {
  if (typeof data !== 'string' || data.length > 8000000) return;
  latestFrame = data;
  drawLatestFrame();
};
window.setFieldDesktopMicrophone = async isOn => {
  const audio = peer?.getTransceivers().find(item => item.receiver.track.kind === 'audio');
  desktopMicrophone?.stop();
  desktopMicrophone = undefined;
  if (!isOn || !audio || !stream) {
    await audio?.sender.replaceTrack(null).catch(() => {});
    reportPickerEvent(isOn ? 'microphone-unavailable' : 'microphone-off');
    return;
  }
  try {
    const microphoneCapture = await navigator.mediaDevices.getUserMedia({ audio: true });
    desktopMicrophone = microphoneCapture.getAudioTracks()[0];
    stream.addTrack(desktopMicrophone);
    await audio.sender.replaceTrack(desktopMicrophone);
    reportPickerEvent('microphone-on');
  } catch {
    reportPickerEvent('microphone-unavailable');
  }
};
const stopDesktopCapture = () => {
  desktopMicrophone?.stop();
  desktopCanvas = desktopTrack = desktopMicrophone = latestFrame = undefined;
};
`;

export default screenPeerDesktop;

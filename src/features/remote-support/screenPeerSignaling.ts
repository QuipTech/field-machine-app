const screenPeerSignaling = `
    let answeredOffer;
    const outboundIce = [];
    const readSignal = data => {
      if (typeof data !== 'string' || data.length > 100000) return;
      try {
        const frame = JSON.parse(data);
        if (frame && typeof frame.messageType === 'string') return frame;
      } catch {
        // A malformed envelope cannot participate in negotiation.
      }
      window.chrome.webview.postMessage('signaling_frame_ignored');
    };
    const readOffer = payload => {
      try {
        const offer = decode(payload);
        if (offer?.type === 'offer' && typeof offer.sdp === 'string') return offer;
      } catch {
        // Keep the peer available for the next offer from the authorized viewer.
      }
      window.chrome.webview.postMessage('signaling_frame_ignored');
    };
    let messages = Promise.resolve();
    currentSocket.onmessage = event => {
      messages = messages.then(async () => {
        if (attempt !== generation) return;
        const frame = readSignal(event.data);
        if (!frame) return;
        if (frame.messageType === 'GO_AWAY') {
          stop('Signaling expired.');
          return;
        }
        if (frame.senderClientId !== config.viewerClientId || typeof frame.messagePayload !== 'string') return;
        if (frame.messageType === 'SDP_OFFER') {
          const offer = readOffer(frame.messagePayload);
          if (!offer) return;
          if (answeredOffer) {
            if (offer.sdp === answeredOffer) send('SDP_ANSWER', currentPeer.localDescription.toJSON());
            return;
          }
          window.chrome.webview.postMessage('sdp_offer_received');
          await currentPeer.setRemoteDescription(offer);
          const video = currentPeer.getTransceivers().find(item => item.receiver.track.kind === 'video');
          if (!video) throw new Error();
          await video.sender.replaceTrack(track);
          video.direction = 'sendonly';
          const audio = currentPeer.getTransceivers().find(item => item.receiver.track.kind === 'audio');
          if (audio) {
            const microphoneTrack = capture.getAudioTracks()[0];
            if (microphoneTrack) await audio.sender.replaceTrack(microphoneTrack);
            audio.direction = microphoneTrack ? 'sendrecv' : 'recvonly';
          }
          for (const candidate of pendingIce) await addIce(candidate);
          await currentPeer.setLocalDescription(await currentPeer.createAnswer());
          send('SDP_ANSWER', currentPeer.localDescription.toJSON());
          answeredOffer = offer.sdp;
          for (const candidate of outboundIce.splice(0)) send('ICE_CANDIDATE', candidate);
        } else if (frame.messageType === 'ICE_CANDIDATE') {
          await receiveIce(frame.messagePayload);
        }
      }).catch(() => {
        if (attempt === generation) {
          if (answeredOffer) {
            window.chrome.webview.postMessage('signaling_frame_ignored');
            return;
          }
          window.chrome.webview.postMessage('negotiation_failed');
          stop('The Portal viewer could not connect.');
        }
      });
    };
`;

export default screenPeerSignaling;

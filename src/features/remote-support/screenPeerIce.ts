const screenPeerIce = `
    const reportIceRejected = () => reportPickerEvent('ice_candidate_rejected');
    const addIce = async candidate => {
      try {
        await currentPeer.addIceCandidate(candidate);
      } catch {
        reportIceRejected();
      }
    };
    const receiveIce = async payload => {
      try {
        const candidate = decode(payload);
        if (currentPeer.remoteDescription) await addIce(candidate);
        else if (pendingIce.length < 128) pendingIce.push(candidate);
      } catch {
        reportIceRejected();
      }
    };
`;

export default screenPeerIce;

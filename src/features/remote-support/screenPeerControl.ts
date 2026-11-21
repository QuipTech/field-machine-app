const screenPeerControl = `
    let controlChannel;
    currentPeer.ondatachannel = event => {
      const channel = event.channel;
      if (surface !== 'monitor' || !config.controlAllowed ||
          channel.label !== 'control' || !channel.ordered || controlChannel) return;
      controlChannel = channel;
      channel.onmessage = message => {
        if (attempt !== generation || currentPeer.connectionState !== 'connected' ||
            track.getSettings().displaySurface !== 'monitor' ||
            track.muted || track.readyState !== 'live' || channel.readyState !== 'open' ||
            typeof message.data !== 'string' || message.data.length > 8192) return;
        try {
          const input = JSON.parse(message.data);
          if (input?.v === 1) window.chrome.webview.postMessage('control:' + message.data);
        } catch {
          // The native bridge receives only JSON protocol messages.
        }
      };
      channel.onclose = channel.onerror = () => {
        channel.onmessage = null;
        if (controlChannel !== channel) return;
        controlChannel = undefined;
        window.chrome.webview.postMessage('control-release');
      };
    };
`;

export default screenPeerControl;

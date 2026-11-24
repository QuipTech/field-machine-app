const getLtscWebView = () => {
  const runtime: object = globalThis;
  const chrome = 'chrome' in runtime ? runtime.chrome : undefined;
  const view = chrome && typeof chrome === 'object' && 'webview' in chrome ? chrome.webview : undefined;
  if (!view || typeof view !== 'object' ||
      !('postMessage' in view) || typeof view.postMessage !== 'function' ||
      !('addEventListener' in view) || typeof view.addEventListener !== 'function' ||
      !('removeEventListener' in view) || typeof view.removeEventListener !== 'function') {
    return undefined;
  }
  return {
    send: view.postMessage.bind(view),
    subscribe: view.addEventListener.bind(view),
    unsubscribe: view.removeEventListener.bind(view),
  };
};

export default getLtscWebView;

const requestStreamingResponse = async (url: string, options: RequestInit): Promise<Response> =>
  new Promise((resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted) {
      reject(new Error('Streaming request aborted.'));
      return;
    }
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = () => {
      cleanup();
      reject(new Error('Streaming request failed.'));
    };
    request.open(options.method ?? 'POST', url);
    request.responseType = 'text';
    request.timeout = 10000;
    new Headers(options.headers).forEach((value, name) => request.setRequestHeader(name, value));
    request.onload = () => {
      cleanup();
      try {
        const body = [204, 205, 304].includes(request.status) ? null : request.responseText;
        resolve(new Response(body, { status: request.status }));
      } catch (error) {
        reject(error);
      }
    };
    request.onabort = fail;
    request.onerror = fail;
    request.ontimeout = fail;
    signal?.addEventListener('abort', abort, { once: true });
    try {
      request.send();
    } catch {
      fail();
    }
  });

export default requestStreamingResponse;

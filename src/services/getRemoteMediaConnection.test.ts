import getRemoteMediaConnection from './getRemoteMediaConnection';

const originalFetch = globalThis.fetch;
const sessionId = '6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10';
const host = 'v-example.kinesisvideo.ap-southeast-2.amazonaws.com';
const query = 'X-Amz-ChannelARN=fixture%3Achannel&X-Amz-Signature=fixture';
const signalingUrl = `wss://${host}/?${query}`;

const mockConnection = (url: string) => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      sessionId,
      role: 'MASTER',
      region: 'ap-southeast-2',
      viewerClientId: 'viewer-fixture',
      signalingUrl: url,
      iceServers: [{ urls: ['stun:example.test:443'] }],
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      controlAllowed: false,
    }),
  });
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('preserves the presigned WebSocket URL without the React Native URL parser', async () => {
  const originalUrl = globalThis.URL;
  const urlParser = jest.spyOn(globalThis, 'URL').mockImplementation(() => {
    throw new Error('The Windows URL parser cannot parse WSS hosts.');
  });
  try {
    mockConnection(signalingUrl);
    const result = await getRemoteMediaConnection('fixture', sessionId, new AbortController().signal);
    expect(result.signalingUrl).toBe(signalingUrl);
    expect(urlParser).not.toHaveBeenCalled();
  } finally {
    urlParser.mockRestore();
    globalThis.URL = originalUrl;
  }
});

test.each([
  `https://${host}/?${query}`,
  `wss://${host}.example.test/?${query}`,
  `wss://${host}@example.test/?${query}`,
])('rejects signaling URLs outside the contract', async url => {
  mockConnection(url);
  await expect(getRemoteMediaConnection('fixture', sessionId, new AbortController().signal))
    .rejects.toThrow('Streaming connection API response did not match the contract (signalingUrl).');
});

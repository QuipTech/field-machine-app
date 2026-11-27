import tabletAccessApi from './tabletAccessApi';

const TOKEN = 'a'.repeat(43);
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null },
    json: () => Promise.resolve(body),
  });

const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

test('register sends only contract fields and parses the reply', async () => {
  mockFetch.mockReturnValue(reply(201, { fieldId: '482915307', tabletToken: TOKEN }));
  const result = await tabletAccessApi.register('Rk7p-Q2mW-x9tH');
  expect(result).toEqual({ kind: 'ok', value: { fieldId: '482915307', tabletToken: TOKEN } });
  const [url, options] = mockFetch.mock.calls[0];
  expect(url).toBe('https://staging-api.quiptechfield.com.au/mc/device/register');
  expect(options.headers.Authorization).toBeUndefined();
  expect(Object.keys(JSON.parse(options.body)).sort()).toEqual(['appVersion', 'password', 'platform']);
});

test('the upgrade call carries the device token', async () => {
  mockFetch.mockReturnValue(reply(201, { fieldId: '482915307', tabletToken: TOKEN }));
  await tabletAccessApi.register('Rk7p-Q2mW-x9tH', 'd'.repeat(43));
  expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${'d'.repeat(43)}`);
});

test('429 retries after the server delay, 5xx and network failures retry', async () => {
  mockFetch.mockReturnValueOnce(reply(429, {}, { 'Retry-After-devicePairing': '12' }));
  expect(await tabletAccessApi.register('Rk7p-Q2mW-x9tH')).toEqual({ kind: 'retry', retryAfterMs: 12000 });
  mockFetch.mockReturnValueOnce(reply(503, {}));
  expect(await tabletAccessApi.getRegistration(TOKEN)).toEqual({ kind: 'retry' });
  mockFetch.mockRejectedValueOnce(new TypeError('offline'));
  expect(await tabletAccessApi.getRegistration(TOKEN)).toEqual({ kind: 'retry' });
});

test('other 4xx return the status and code without retrying', async () => {
  mockFetch.mockReturnValue(reply(409, { code: 'tablet_password_managed_in_portal', message: 'x' }));
  expect(await tabletAccessApi.changePassword(TOKEN, 'new-password')).toEqual({
    kind: 'error', status: 409, code: 'tablet_password_managed_in_portal',
  });
});

test('a malformed success is reported as a contract mismatch', async () => {
  mockFetch.mockReturnValue(reply(200, { fieldId: '012345678', assigned: false, machine: null }));
  expect(await tabletAccessApi.getRegistration(TOKEN)).toEqual({ kind: 'error', status: 200, code: 'invalid_response' });
});

import validateSession from './deviceSessionService';
import environment from '../config/environment';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = mockFetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

test.each([
  [200, {}, 'valid'],
  [401, { code: 'DEVICE_TOKEN_REVOKED' }, 'revoked'],
  [401, { message: 'Unauthorized' }, 'unavailable'],
  [500, { code: 'DEVICE_TOKEN_REVOKED' }, 'unavailable'],
  [404, null, 'unavailable'],
])(
  'classifies HTTP %s without guessing revocation',
  async (status, body, expected) => {
    mockFetch.mockResolvedValue({ status, json: async () => body });
    const result = await validateSession(
      'private-token',
      new AbortController().signal,
    );
    expect(result.status).toBe(expected);
  },
);

test('preserves a configured API prefix and sends auth only in headers', async () => {
  const previousUrl = environment.apiBaseUrl;
  environment.apiBaseUrl = `${previousUrl}/api`;
  mockFetch.mockResolvedValue({ status: 200, json: async () => ({}) });
  const controller = new AbortController();
  try {
    await validateSession('private-token', controller.signal);
    expect(mockFetch).toHaveBeenCalledWith(
      `${previousUrl}/api/mc/device/session`,
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer private-token',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        signal: controller.signal,
      },
    );
  } finally {
    environment.apiBaseUrl = previousUrl;
  }
});

test('malformed unauthorized response is not treated as token revocation', async () => {
  mockFetch.mockResolvedValue({
    status: 401,
    json: async () => {
      throw new Error('not JSON');
    },
  });
  await expect(
    validateSession('token', new AbortController().signal),
  ).resolves.toMatchObject({ status: 'unavailable', httpStatus: 401 });
});

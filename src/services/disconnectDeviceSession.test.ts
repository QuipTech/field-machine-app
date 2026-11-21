import disconnectDeviceSession from './disconnectDeviceSession';
import environment from '../config/environment';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = mockFetch;
});
afterEach(() => {
  jest.useRealTimers();
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

test.each([200, 204])(
  'confirms HTTP %s with no response body required',
  async status => {
    mockFetch.mockResolvedValue({
      status,
      json: async () => {
        throw new Error('empty');
      },
    });
    await expect(
      disconnectDeviceSession('test-token'),
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${environment.apiBaseUrl}${environment.sessionPath}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
      }),
    );
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('body');
  },
);

test('already revoked 401 allows local cleanup', async () => {
  mockFetch.mockResolvedValue({
    status: 401,
    json: async () => ({ code: 'DEVICE_TOKEN_REVOKED' }),
  });
  await expect(disconnectDeviceSession('test-token')).resolves.toBeUndefined();
});

test.each([202, 400, 401, 403, 404, 500])(
  'does not infer completed disconnect from HTTP %s',
  async status => {
    mockFetch.mockResolvedValue({
      status,
      json: async () => ({ message: 'test-token' }),
    });
    await expect(disconnectDeviceSession('test-token')).rejects.toThrow(
      'Saved pairing was kept',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  },
);

test('network errors stay private and do not retry DELETE automatically', async () => {
  mockFetch.mockRejectedValue(new Error('test-token'));
  await expect(disconnectDeviceSession('test-token')).rejects.toThrow(
    'Disconnect could not be confirmed.',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('times out and aborts the request, retaining auth for an explicit retry', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation(
    (_url: string, request: RequestInit) =>
      new Promise((_resolve, reject) => {
        request.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      }),
  );
  const result = disconnectDeviceSession('test-token').then(
    () => null,
    (error: unknown) => error,
  );
  jest.advanceTimersByTime(20000);
  const error = await result;
  expect(error).toBeInstanceOf(Error);
  if (error instanceof Error) {
    expect(error.message).toContain('Saved pairing was kept');
  }
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

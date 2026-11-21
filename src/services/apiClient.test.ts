import postPublicJson from './apiClient';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = mockFetch;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

const respondWith = (status: number, body: unknown) => {
  mockFetch.mockResolvedValue({ status, json: async () => body });
};

test.each([
  ["That code isn't valid or has expired."],
  [['The pairing code is 6 digits.']],
  [{ message: ['The pairing code is 6 digits.'] }],
])('handles documented error shape %p', async body => {
  respondWith(400, body);
  await expect(postPublicJson('/mc/device/pair', {})).rejects.toThrow(
    typeof body === 'string' ? body : 'The pairing code is 6 digits.',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('does not automatically retry rate-limited requests', async () => {
  respondWith(429, null);
  await expect(postPublicJson('/mc/device/pair', {})).rejects.toThrow(
    'Wait at least one minute',
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('explains an uncertain outcome after network failure', async () => {
  mockFetch.mockRejectedValue(new TypeError('Network request failed'));
  await expect(postPublicJson('/mc/device/pair', {})).rejects.toThrow(
    'may have completed',
  );
});

test('sends staging JSON without sign-in credentials', async () => {
  respondWith(201, { result: 'ok' });
  await postPublicJson('/mc/device/pair', { code: '123456' });
  expect(mockFetch).toHaveBeenCalledWith(
    'https://staging-api.quiptechfield.com.au/mc/device/pair',
    expect.objectContaining({ method: 'POST', body: '{"code":"123456"}' }),
  );
});

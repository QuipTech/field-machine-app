import type { RemoteRequest } from '../../services/getCurrentRemoteSession';
import describeRemoteCheck from './describeRemoteCheck';

const now = Date.parse('2026-11-25T09:22:00.000Z');
const session: RemoteRequest = {
  id: 'a2b1c3d4-1234-4123-8123-123456789012',
  machineId: 'a2b1c3d4-1234-4123-8123-123456789013',
  deviceId: 'a2b1c3d4-1234-4123-8123-123456789014',
  status: 'requested',
  initiatedBy: 'portal',
  access: 'prompt',
  scope: { view: true, control: false, record: false },
  expiresAt: '2026-11-25T09:10:00.000Z',
};
const base = { session, isUnavailable: false, isWrongPairing: false };

test('explains a request hidden by a fast tablet clock', () => {
  const result = describeRemoteCheck({ ...base, serverTime: now - 14 * 60000 }, now);
  expect(result.message).toContain('14 min fast');
  expect(result.detail).toBe('request_expired_by_tablet_clock clock=+14min');
});

test('reports a slow clock before any request arrives', () => {
  const result = describeRemoteCheck({ ...base, session: null, serverTime: now + 5 * 60000 }, now);
  expect(result.message).toContain('5 min slow');
  expect(result.detail).toBe('no_request clock=-5min');
});

test('reports an expired request when the clock is correct', () => {
  const result = describeRemoteCheck({ ...base, serverTime: now }, now);
  expect(result.message).toContain('has expired');
});

test('stays silent for a live request and tolerates a missing server time', () => {
  const live = { ...session, expiresAt: '2026-11-25T09:24:00.000Z' };
  expect(describeRemoteCheck({ ...base, session: live }, now)).toEqual({
    message: undefined, detail: 'request_from_portal clock=unknown',
  });
});

test('keeps denied and wrong pairing messages ahead of clock advice', () => {
  const serverTime = now - 14 * 60000;
  expect(describeRemoteCheck({ ...base, isUnavailable: true, session: null, serverTime }, now).message)
    .toContain('denied');
  expect(describeRemoteCheck({ ...base, isWrongPairing: true, serverTime }, now).message)
    .toContain('different tablet');
});

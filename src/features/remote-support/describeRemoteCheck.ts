import type { RemoteRequest } from '../../services/getCurrentRemoteSession';

const MAX_CLOCK_SKEW_MS = 60000;

interface RemoteCheck {
  session: RemoteRequest | null;
  isUnavailable: boolean;
  isWrongPairing: boolean;
  serverTime?: number;
}

// Details are fixed labels and a skew in seconds, so they are safe to record.
const describeRemoteCheck = (check: RemoteCheck, now: number) => {
  const { session, isUnavailable, isWrongPairing, serverTime } = check;
  const skew = serverTime === undefined ? undefined : now - serverTime;
  const isClockWrong = skew !== undefined && Math.abs(skew) > MAX_CLOCK_SKEW_MS;
  const hasExpired = session?.status === 'requested' && Date.parse(session.expiresAt) <= now;
  const outcome = isUnavailable ? 'denied'
    : isWrongPairing ? 'wrong_pairing'
      : hasExpired ? 'request_expired_by_tablet_clock'
        : session?.status === 'requested' ? `request_from_${session.initiatedBy}`
          : session?.status === 'active' ? 'active'
            : session ? 'other_status' : 'no_request';
  const clock = skew === undefined ? 'unknown'
    : isClockWrong ? `${skew > 0 ? '+' : '-'}${Math.round(Math.abs(skew) / 60000)}min` : 'ok';
  let message: string | undefined;
  if (isUnavailable) {
    message = 'The API denied the tablet’s remote request check.';
  } else if (isWrongPairing) {
    message = 'The API returned a remote session for a different tablet or machine.';
  } else if (isClockWrong) {
    const minutes = Math.round(Math.abs(skew) / 60000);
    message = `This tablet’s clock is about ${minutes} min ${skew > 0 ? 'fast' : 'slow'}. ` +
      'Set the Windows date and time automatically, or support requests may not appear.';
  } else if (hasExpired) {
    message = 'The latest support request has expired. Ask the Portal to send a new one.';
  }
  return { message, detail: `${outcome} clock=${clock}` };
};

export default describeRemoteCheck;

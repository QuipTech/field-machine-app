import deviceSessionRequest from './deviceSessionRequest';

export interface SessionResult {
  status: 'valid' | 'revoked' | 'unavailable';
  httpStatus: number;
  code: 'DEVICE_TOKEN_REVOKED' | 'unrecognized';
}

const validateSession = async (
  deviceToken: string,
  signal: AbortSignal,
): Promise<SessionResult> => {
  const { httpStatus, isRevoked } = await deviceSessionRequest(
    'GET',
    deviceToken,
    signal,
  );
  return {
    status: isRevoked
      ? 'revoked'
      : httpStatus === 200
      ? 'valid'
      : 'unavailable',
    httpStatus,
    code: isRevoked ? 'DEVICE_TOKEN_REVOKED' : 'unrecognized',
  };
};

export default validateSession;

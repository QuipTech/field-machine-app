import { z } from 'zod';
import environment from '../config/environment';

const revokedSchema = z.object({ code: z.literal('DEVICE_TOKEN_REVOKED') });

const deviceSessionRequest = async (
  method: 'GET' | 'DELETE',
  deviceToken: string,
  signal: AbortSignal,
) => {
  const response = await fetch(
    `${environment.apiBaseUrl}${environment.sessionPath}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      signal,
    },
  );
  const body: unknown = await response.json().catch(() => null);
  return {
    httpStatus: response.status,
    isRevoked: response.status === 401 && revokedSchema.safeParse(body).success,
  };
};

export default deviceSessionRequest;

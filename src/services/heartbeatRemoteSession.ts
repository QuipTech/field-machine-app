import { z } from 'zod';
import environment from '../config/environment';

const heartbeatSchema = z.object({ id: z.string().uuid(), status: z.string() });

const heartbeatRemoteSession = async (token: string, id: string, signal: AbortSignal) => {
  const response = await fetch(
    `${environment.apiBaseUrl}/mc/device/remote-sessions/${encodeURIComponent(id)}/heartbeat`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ interacted: false }),
      signal,
    },
  );
  if (!response.ok) {
    return false;
  }
  const session = heartbeatSchema.safeParse(await response.json());
  return session.success && session.data.id === id && session.data.status === 'active';
};

export default heartbeatRemoteSession;

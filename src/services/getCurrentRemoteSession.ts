import { z } from 'zod';
import environment from '../config/environment';

const sessionSchema = z.object({
  id: z.string().uuid(),
  machineId: z.string().uuid(),
  deviceId: z.string().uuid(),
  status: z.string().min(1),
  // The original Portal-only contract omitted the origin.
  initiatedBy: z.enum(['portal', 'tablet']).default('portal'),
  // FIELD ID tablets get `unattended` sessions, active at once with no prompt.
  access: z.enum(['prompt', 'unattended']).default('prompt'),
  requester: z.object({ name: z.string().min(1).max(500) }).nullish(),
  scope: z.object({ view: z.boolean(), control: z.boolean(), record: z.boolean() }),
  recording: z.object({ status: z.enum(['pending', 'recording', 'completed', 'failed', 'none']) }).optional(),
  expiresAt: z.iso.datetime(),
});

export type RemoteRequest = z.infer<typeof sessionSchema>;

const currentSchema = z.object({ session: sessionSchema.nullable() });

const getCurrentRemoteSession = async (token: string, signal: AbortSignal) => {
  const response = await fetch(
    `${environment.apiBaseUrl}/mc/device/remote-sessions/current`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal },
  );
  const date = Date.parse(response.headers?.get('Date') ?? '');
  const serverTime = Number.isNaN(date) ? undefined : date;
  if (response.status === 401 || response.status === 403) {
    return { session: null, isUnavailable: true, serverTime };
  }
  if (!response.ok) {
    throw new Error('Could not check remote support requests.');
  }
  const { session } = currentSchema.parse(await response.json());
  return { session, isUnavailable: false, serverTime };
};

export default getCurrentRemoteSession;

import { z } from 'zod';
import environment from '../config/environment';

// React Native Windows' URL.hostname only parses HTTP(S), so validate the WSS
// authority directly and preserve the signed URL byte for byte.
const KINESIS_HOST = 'kinesisvideo.ap-southeast-2.amazonaws.com';
const isSignalingUrl = (value: string) => {
  if (!value.startsWith('wss://') || /[\s#\\]/.test(value)) return false;
  const query = value.indexOf('?');
  if (query < 0 || query === value.length - 1) return false;
  const authority = value.slice(6, query).split('/')[0];
  const host = authority.endsWith(':443') ? authority.slice(0, -4) : authority;
  return (host === KINESIS_HOST || host.endsWith(`.${KINESIS_HOST}`)) &&
    host.split('.').every(label => /^[a-z0-9-]{1,63}$/.test(label) &&
      !label.startsWith('-') && !label.endsWith('-'));
};

const connectionSchema = z.object({
  sessionId: z.string().uuid(),
  role: z.literal('MASTER'),
  region: z.literal('ap-southeast-2'),
  viewerClientId: z.string().min(1),
  signalingUrl: z.string().refine(isSignalingUrl),
  iceServers: z.array(z.object({
    urls: z.array(z.string().regex(/^(stun|stuns|turn|turns):/)).min(1),
    username: z.string().optional(),
    credential: z.string().optional(),
  })).min(1),
  expiresAt: z.iso.datetime(),
  controlAllowed: z.boolean(),
});

export type RemoteMediaConnection = z.infer<typeof connectionSchema>;

const errorCodeSchema = z.object({ code: z.enum([
  'DEVICE_TOKEN_REVOKED',
  'remote_support_unavailable_for_machine',
  'remote_session_not_found',
  'remote_session_not_active',
  'remote_support_unavailable',
]) });

const getRemoteMediaConnection = async (
  token: string,
  id: string,
  signal: AbortSignal,
  onHttpStatus?: (status: number) => void,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
  onStage?: (stage: 'body' | 'schema', elapsed: number) => void,
) => {
  const response = await request(
    `${environment.apiBaseUrl}/mc/device/remote-sessions/${encodeURIComponent(id)}/connection`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal },
  ).catch(() => {
    throw new Error(signal.aborted
      ? 'Streaming connection request timed out.'
      : 'Could not reach the streaming connection API.');
  });
  if (!signal.aborted) {
    onHttpStatus?.(response.status);
  }
  if (!response.ok) {
    const error = errorCodeSchema.safeParse(await response.json().catch(() => null));
    const code = error.success ? ` (${error.data.code})` : '';
    throw new Error(`Streaming connection API returned HTTP ${response.status}${code}.`);
  }
  const bodyStarted = Date.now();
  const body: unknown = await response.json().catch(() => null);
  onStage?.('body', Date.now() - bodyStarted);
  const schemaStarted = Date.now();
  const result = connectionSchema.safeParse(body, { jitless: true });
  onStage?.('schema', Date.now() - schemaStarted);
  if (!result.success) {
    const field = result.error.issues[0]?.path[0];
    const label = typeof field === 'string' && Object.hasOwn(connectionSchema.shape, field)
      ? ` (${field})`
      : '';
    throw new Error(`Streaming connection API response did not match the contract${label}.`);
  }
  if (result.data.sessionId !== id) {
    throw new Error('Streaming connection API returned a different session.');
  }
  if (Date.parse(result.data.expiresAt) <= Date.now()) {
    throw new Error('Streaming credentials have expired. Check the tablet clock.');
  }
  return result.data;
};

export default getRemoteMediaConnection;

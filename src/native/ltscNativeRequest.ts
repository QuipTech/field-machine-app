import { z } from 'zod';
import getLtscWebView from './ltscWebView';

const replySchema = z.object({
  type: z.string(),
  id: z.string(),
  ok: z.boolean(),
  value: z.unknown(),
});

const ltscNativeRequest = <Value>(
  type: 'field-design' | 'field-portal-files' | 'field-input' | 'field-desktop' | 'field-access',
  operation: string,
  schema: z.ZodType<Value>,
  argumentsForHost: Record<string, string | number> = {},
  timeoutMs = 10000,
) => new Promise<Value>((resolve, reject) => {
  const view = getLtscWebView();
  if (!view) {
    reject(new Error('The Windows file service is unavailable.'));
    return;
  }
  const { send, subscribe, unsubscribe } = view;
  const id = globalThis.crypto.randomUUID();
  const finish = () => {
    clearTimeout(timeout);
    unsubscribe('message', onMessage);
  };
  const onMessage = (event: { data: unknown }) => {
    const reply = replySchema.safeParse(event.data);
    if (!reply.success || reply.data.type !== type || reply.data.id !== id) return;
    finish();
    const result = schema.safeParse(reply.data.value);
    if (reply.data.ok && result.success) resolve(result.data);
    else reject(new Error('The Windows file service could not complete the request.'));
  };
  const timeout = setTimeout(() => {
    finish();
    reject(new Error('The Windows file service did not respond.'));
  }, timeoutMs);
  subscribe('message', onMessage);
  try {
    send({ ...argumentsForHost, type, id, operation });
  } catch {
    finish();
    reject(new Error('Could not contact the Windows file service.'));
  }
});

export default ltscNativeRequest;

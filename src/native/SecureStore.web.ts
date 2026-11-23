import { z } from 'zod';
import type { SecureStoreModule } from './SecureStore';
import getLtscWebView from './ltscWebView';

const replySchema = z.object({
  type: z.literal('field-storage'),
  id: z.number().int(),
  ok: z.boolean(),
  value: z.string().nullable(),
});

let requestId = 0;

const invokeStorage = (operation: 'read' | 'write' | 'remove', key: string, value?: string) =>
  new Promise<string | null>((resolve, reject) => {
    const view = getLtscWebView();
    if (!view) {
      reject(new Error('Windows secure storage is unavailable.'));
      return;
    }
    const { subscribe, unsubscribe, send } = view;
    const id = ++requestId;
    const finish = () => {
      clearTimeout(timeout);
      unsubscribe('message', onMessage);
    };
    const onMessage = (event: { data: unknown }) => {
      const reply = replySchema.safeParse(event.data, { jitless: true });
      if (!reply.success || reply.data.id !== id) return;
      finish();
      if (reply.data.ok) resolve(reply.data.value);
      else reject(new Error('Windows secure storage could not complete the request.'));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('Windows secure storage did not respond.'));
    }, 5000);
    subscribe('message', onMessage);
    try {
      send({ type: 'field-storage', id, operation, key, value });
    } catch {
      finish();
      reject(new Error('Could not contact Windows secure storage.'));
    }
  });

const getSecureStore = (): SecureStoreModule => ({
  read: key => invokeStorage('read', key),
  write: async (key, value) => { await invokeStorage('write', key, value); },
  remove: async key => { await invokeStorage('remove', key); },
});

export default getSecureStore;

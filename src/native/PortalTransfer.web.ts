import { z } from 'zod';
import ltscNativeRequest from './ltscNativeRequest';
import getLtscWebView from './ltscWebView';
import { pendingSchema, responseSchema, uploadProgressSchema } from './portalTransferSchema';

const service = 'field-portal-files';
const progressSchema = uploadProgressSchema.extend({ type: z.literal('field-portal-progress') });

const portalTransfer = {
  isSupported: Boolean(getLtscWebView()),
  pick: () => ltscNativeRequest(service, 'pick', z.array(z.string().min(1)), {}, 300000),
  stage: async (pairing: string) => {
    await ltscNativeRequest(service, 'stage', z.null(), { pairing }, 120000);
  },
  list: (pairing: string) => ltscNativeRequest(service, 'list', pendingSchema, { pairing }),
  remove: async (pairing: string, transferId: string) => {
    await ltscNativeRequest(service, 'remove', z.null(), { pairing, transferId });
  },
  upload: (_url: string, token: string, pairing: string, transferId: string) =>
    ltscNativeRequest(service, 'upload', responseSchema, { token, pairing, transferId }, 320000),
  subscribe: (listener: (id: string, percent: number) => void) => {
    const view = getLtscWebView();
    const onMessage = (event: { data: unknown }) => {
      const result = progressSchema.safeParse(event.data);
      if (result.success) listener(result.data.id, result.data.percent);
    };
    view?.subscribe('message', onMessage);
    return { remove: () => view?.unsubscribe('message', onMessage) };
  },
};

export default portalTransfer;

import { z } from 'zod';
import environment from '../../config/environment';
import deliverySchema, { type Status } from './designState';
import checkDeliveryActive from './checkDeliveryActive';

const route = '/mc/device/designs';
const nextSchema = z.object({ delivery: deliverySchema.nullable() });
const urlSchema = z.object({ url: z.url({ protocol: /^https$/ }), expiresAt: z.iso.datetime({ offset: true }) });
const statusSchema = z.object({ status: z.enum(['downloading', 'arrived', 'failed']) });

const designApi = (token: () => string, signal: AbortSignal) => {
  const request = async (path: string, update?: Status): Promise<unknown> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    checkDeliveryActive(signal);
    signal.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 20000);
    try {
      const response = await fetch(`${environment.apiBaseUrl}${route}${path}`, {
        method: update ? 'PATCH' : 'GET',
        headers: {
          Authorization: `Bearer ${token()}`,
          Accept: 'application/json',
          ...(update ? { 'Content-Type': 'application/json' } : {}),
        },
        body: update ? JSON.stringify(update) : undefined,
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw new Error('Design service could not complete the request.');
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  };

  return {
    next: async () => nextSchema.parse(await request('/next')).delivery,
    file: async (id: string, index: number) => urlSchema.parse(await request(`/${id}/files/${index}`)),
    status: async (id: string, update: Status) => {
      const response = statusSchema.parse(await request(`/${id}`, update));
      if (response.status !== update.status) {
        throw new Error('Design status could not be confirmed.');
      }
    },
  };
};

export default designApi;

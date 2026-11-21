import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { z } from 'zod';

const pendingSchema = z.array(
  z.object({ id: z.string().uuid(), fileName: z.string().min(1) }),
);
const responseSchema = z.object({ status: z.number().int(), body: z.string() });

export type PendingTransfer = z.infer<typeof pendingSchema>[number];

interface NativePortalTransfer {
  pick: () => Promise<unknown>;
  stage: (pairing: string) => Promise<void>;
  list: (pairing: string) => Promise<unknown>;
  remove: (pairing: string, id: string) => Promise<void>;
  upload: (url: string, token: string, pairing: string, id: string) => Promise<unknown>;
}

const getNativeModule = (): NativePortalTransfer => {
  const module: NativePortalTransfer | undefined = NativeModules.FieldMachinePortalTransfer;
  if (!module) {
    throw new Error('File sharing requires an updated FIELD Machine app.');
  }
  return module;
};

const portalTransfer = {
  isSupported: Platform.OS === 'windows' || Platform.OS === 'android',
  pick: async () => z.array(z.string().min(1)).parse(await getNativeModule().pick()),
  stage: async (pairing: string) => getNativeModule().stage(pairing),
  list: async (pairing: string) => pendingSchema.parse(await getNativeModule().list(pairing)),
  remove: async (pairing: string, id: string) => getNativeModule().remove(pairing, id),
  upload: async (url: string, token: string, pairing: string, id: string) =>
    responseSchema.parse(await getNativeModule().upload(url, token, pairing, id)),
  subscribe: (listener: (id: string, percent: number) => void) =>
    DeviceEventEmitter.addListener('fieldPortalUploadProgress', (value: unknown) => {
      const event = z.object({ id: z.string(), percent: z.number() }).safeParse(value);
      if (event.success) {
        listener(event.data.id, event.data.percent);
      }
    }),
};

export default portalTransfer;

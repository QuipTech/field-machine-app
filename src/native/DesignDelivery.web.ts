import { z } from 'zod';
import type { NativeDesignDelivery } from './DesignDelivery';
import ltscNativeRequest from './ltscNativeRequest';

const designStorage: NativeDesignDelivery = {
  readJournal: scope => ltscNativeRequest('field-design', 'readJournal', z.string(), { scope }),
  writeJournal: async (scope, payload) => {
    await ltscNativeRequest('field-design', 'writeJournal', z.null(), { scope, payload });
  },
  prepare: async (scope, delivery, project) => {
    await ltscNativeRequest('field-design', 'prepare', z.null(), { scope, delivery, project });
  },
  download: (scope, delivery, project, path, index, size, sha256, url) =>
    ltscNativeRequest('field-design', 'download',
      z.enum(['verified', 'retry', 'expired', 'checksum', 'path', 'permanent']),
      { scope, delivery, project, path, index, size, sha256, url }, 920000),
  stop: () => {
    ltscNativeRequest('field-design', 'stop', z.null()).catch(() => undefined);
  },
  openProject: async (scope, delivery, project) => {
    await ltscNativeRequest('field-design', 'openProject', z.null(), { scope, delivery, project });
  },
};

export default designStorage;

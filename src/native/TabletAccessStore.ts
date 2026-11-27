import { z } from 'zod';
import {
  accessRecordSchema,
  type TabletAccessRecord,
} from '../features/tablet-access/tabletAccessSchema';
import ltscNativeRequest from './ltscNativeRequest';
import getLtscWebView from './ltscWebView';

// The tablet's FIELD ID access record, encrypted with Windows DPAPI for the
// whole tablet. Only the Windows LTSC host provides it.
const service = 'field-access';

let queue: Promise<unknown> = Promise.resolve();
// Serialize storage so a late write can never resurrect a dropped token.
const serialize = <Value>(operation: () => Promise<Value>) => {
  const task = queue.then(operation, operation);
  queue = task.catch(() => undefined);
  return task;
};

const read = () => serialize(async (): Promise<TabletAccessRecord | null> => {
  const raw = await ltscNativeRequest(service, 'read', z.string().nullable());
  if (raw === null) return null;
  const parsed = accessRecordSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error('The saved FIELD ID could not be read. Contact support; it has not been deleted.');
  }
  return parsed.data;
});

const write = (record: TabletAccessRecord) => serialize(async () => {
  await ltscNativeRequest(service, 'write', z.null(), { value: JSON.stringify(accessRecordSchema.parse(record)) });
});

const remove = () => serialize(async () => {
  await ltscNativeRequest(service, 'remove', z.null());
});

const tabletAccessStore = {
  isSupported: Boolean(getLtscWebView()),
  read,
  write,
  remove,
};

export default tabletAccessStore;

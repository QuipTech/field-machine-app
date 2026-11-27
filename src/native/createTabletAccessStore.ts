import {
  accessRecordSchema,
  type TabletAccessRecord,
} from '../features/tablet-access/tabletAccessSchema';

// Platform storage for the encrypted record, as plain text in and out.
export interface TabletAccessBackend {
  isSupported: boolean;
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
}

const createTabletAccessStore = (backend: TabletAccessBackend) => {
  let queue: Promise<unknown> = Promise.resolve();
  // Serialize storage so a late write can never resurrect a dropped token.
  const serialize = <Value>(operation: () => Promise<Value>) => {
    const task = queue.then(operation, operation);
    queue = task.catch(() => undefined);
    return task;
  };

  const read = () => serialize(async (): Promise<TabletAccessRecord | null> => {
    const raw = await backend.read();
    if (raw === null) return null;
    const parsed = accessRecordSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error('The saved FIELD ID could not be read. Contact support; it has not been deleted.');
    }
    return parsed.data;
  });

  const write = (record: TabletAccessRecord) => serialize(async () => {
    await backend.write(JSON.stringify(accessRecordSchema.parse(record)));
  });

  const remove = () => serialize(backend.remove);

  return { isSupported: backend.isSupported, read, write, remove };
};

export default createTabletAccessStore;

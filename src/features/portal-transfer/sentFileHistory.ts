import { z } from 'zod';
import storage from '../../native/DesignDelivery';

const receiptSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  uploadedAt: z.iso.datetime(),
});

export type SentReceipt = z.infer<typeof receiptSchema>;

const historySchema = z.object({ receipts: z.array(receiptSchema) });
const emptyJournal = z.object({ projects: z.tuple([]), pending: z.null() }).strict();

// Use a separate namespace with the existing atomic app-local journal adapter.
const historyScope = (pairing: string) => `sent-${pairing}`;

const read = async (pairing: string) => {
  if (!storage) {
    throw new Error('Sent file storage is unavailable.');
  }
  const payload: unknown = JSON.parse(await storage.readJournal(historyScope(pairing)));
  return emptyJournal.safeParse(payload).success ? [] : historySchema.parse(payload).receipts;
};

const writes = new Map<string, Promise<void>>();

const record = (pairing: string, receipt: SentReceipt) => {
  const previous = writes.get(pairing) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    const receipts = await read(pairing);
    if (!receipts.some(item => item.id === receipt.id)) {
      if (!storage) {
        throw new Error('Sent file storage is unavailable.');
      }
      await storage.writeJournal(historyScope(pairing), JSON.stringify({ receipts: [receipt, ...receipts] }));
    }
  });
  writes.set(pairing, task);
  return task.finally(() => {
    if (writes.get(pairing) === task) {
      writes.delete(pairing);
    }
  });
};

export default { read, record };

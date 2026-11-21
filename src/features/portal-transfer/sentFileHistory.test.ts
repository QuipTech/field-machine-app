import storage from '../../native/DesignDelivery';
import history from './sentFileHistory';

jest.mock('../../native/DesignDelivery', () => ({
  readJournal: jest.fn(),
  writeJournal: jest.fn(),
}));

const first = { id: 'first', fileName: 'demo.pdf', uploadedAt: '2026-11-18T18:00:00Z' };
const second = { ...first, id: 'second' };

test('keeps concurrent receipts, deduplicates replays, and scopes history to the pairing', async () => {
  if (!storage) {
    throw new Error('Expected mocked journal storage.');
  }
  const journals = new Map<string, string>();
  jest.mocked(storage.readJournal).mockImplementation(async scope =>
    journals.get(scope) ?? '{"projects":[],"pending":null}',
  );
  jest.mocked(storage.writeJournal).mockImplementation(async (scope, payload) => {
    journals.set(scope, payload);
  });
  await Promise.all([
    history.record('staging_a_b', first),
    history.record('staging_a_b', second),
    history.record('staging_a_b', first),
  ]);
  await expect(history.read('staging_a_b')).resolves.toEqual([second, first]);
  await expect(history.read('staging_a_c')).resolves.toEqual([]);
  expect(storage.writeJournal).toHaveBeenCalledTimes(2);
});

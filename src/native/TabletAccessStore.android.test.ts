import tabletAccessStore from './TabletAccessStore.android';

const mockValues = new Map<string, string>();
jest.mock('./SecureStore', () => () => ({
  read: async (key: string) => mockValues.get(key) ?? null,
  write: async (key: string, value: string) => { mockValues.set(key, value); },
  remove: async (key: string) => { mockValues.delete(key); },
}));

const record = { version: 1 as const, fieldId: '482915307', tabletToken: 'a'.repeat(43) };

beforeEach(() => mockValues.clear());

test('saves, reads and removes the record under the allowlisted key', async () => {
  expect(await tabletAccessStore.read()).toBeNull();
  await tabletAccessStore.write(record);
  expect([...mockValues.keys()]).toEqual(['field-access.staging.v1']);
  expect(await tabletAccessStore.read()).toEqual(record);
  await tabletAccessStore.remove();
  expect(await tabletAccessStore.read()).toBeNull();
});

test('reports an unreadable record without deleting it', async () => {
  mockValues.set('field-access.staging.v1', '{"version":9}');
  await expect(tabletAccessStore.read()).rejects.toThrow('has not been deleted');
  expect(mockValues.size).toBe(1);
});

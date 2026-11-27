import { TurboModuleRegistry } from 'react-native';
import createTabletPassword from './createTabletPassword.android';

const mockRandomBytes = (bytes: number[]) => {
  const module = { randomBytes: async () => bytes };
  jest.spyOn(TurboModuleRegistry, 'get')
    .mockReturnValue(module as unknown as ReturnType<typeof TurboModuleRegistry.get>);
};

afterEach(() => jest.restoreAllMocks());

test('builds a grouped password from native random bytes', async () => {
  mockRandomBytes(Array.from({ length: 128 }, (_, index) => index));
  expect(await createTabletPassword()).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
});

test('fails instead of using a short or exhausted pool', async () => {
  mockRandomBytes([1, 2, 3]);
  await expect(createTabletPassword()).rejects.toThrow();
  mockRandomBytes(Array.from({ length: 128 }, () => 255));
  await expect(createTabletPassword()).rejects.toThrow('Could not create a tablet password');
});

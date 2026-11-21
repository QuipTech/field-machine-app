import { TurboModuleRegistry } from 'react-native';
import getSecureStore from './SecureStore';

afterEach(() => {
  jest.restoreAllMocks();
});

test('explains how to update an older native build without deleting pairing', async () => {
  const read = jest.fn().mockResolvedValue('saved pairing');
  const write = jest.fn();
  const nativeStore = { read, write, getConstants: () => ({}) };
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(nativeStore);

  const store = getSecureStore();
  await expect(store.read('pairing.staging.v1')).resolves.toBe('saved pairing');
  await expect(store.remove('pairing.staging.v1')).rejects.toThrow(
    'run npm run windows to rebuild',
  );
  expect(write).not.toHaveBeenCalled();
});

test('delegates removal to the updated native module', async () => {
  const remove = jest.fn().mockResolvedValue(undefined);
  const nativeStore = {
    getConstants: () => ({}),
    read: jest.fn(),
    write: jest.fn(),
    remove,
  };
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(nativeStore);

  await expect(
    getSecureStore().remove('pairing.staging.v1'),
  ).resolves.toBeUndefined();
  expect(remove).toHaveBeenCalledWith('pairing.staging.v1');
});

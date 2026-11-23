import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface SecureStoreModule extends TurboModule {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const getSecureStore = (): SecureStoreModule => {
  const secureStore = TurboModuleRegistry.get<SecureStoreModule>(
    'FieldMachineSecureStore',
  );
  if (!secureStore) {
    throw new Error(
      'Secure storage is unavailable. Rebuild the app so the SecureStore native module is included.',
    );
  }
  // Metro can serve newer JavaScript to an older installed native executable.
  return {
    read: key => secureStore.read(key),
    write: (key, value) => secureStore.write(key, value),
    remove: async key => {
      if (typeof secureStore.remove !== 'function') {
        throw new Error(
          'This Windows build cannot remove saved pairing. Close the app, run npm run windows to rebuild it, then try again. Metro reload alone cannot update native modules.',
        );
      }
      await secureStore.remove(key);
    },
  };
};

export default getSecureStore;

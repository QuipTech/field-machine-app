import { TurboModuleRegistry, type TurboModule } from 'react-native';
import { z } from 'zod';
import generateTabletPassword from '../features/tablet-access/generateTabletPassword';

interface SecureRandomModule extends TurboModule {
  randomBytes: (count: number) => Promise<unknown>;
}

// Far more than one password needs, to cover rejected samples.
const POOL_SIZE = 128;
const poolSchema = z.array(z.number().int().min(0).max(255)).length(POOL_SIZE);

// Hermes has no Web Crypto, so the bytes come from Java's SecureRandom.
const createTabletPassword = async () => {
  const module = TurboModuleRegistry.get<SecureRandomModule>('FieldMachineSecureRandom');
  if (!module) throw new Error('Secure random is unavailable. Rebuild the app.');
  const pool = poolSchema.parse(await module.randomBytes(POOL_SIZE));
  let next = 0;
  return generateTabletPassword(bytes => {
    for (let index = 0; index < bytes.length; index++) {
      const byte = pool[next++];
      if (byte === undefined) throw new Error('Could not create a tablet password. Try again.');
      bytes[index] = byte;
    }
    return bytes;
  });
};

export default createTabletPassword;

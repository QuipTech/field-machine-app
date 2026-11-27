import type tabletAccessApi from '../../services/tabletAccessApi';
import type { ApiResult } from '../../services/tabletAccessApi';
import type { PairedDevice } from '../pairing/pairingSchema';
import type { TabletAccessRecord } from './tabletAccessSchema';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const POLL_MS = 5000;

export interface AccessUpdate {
  phase: 'registering' | 'waiting' | 'connecting';
  record?: TabletAccessRecord;
  notice?: string;
}

export interface AccessDeps {
  store: { read: () => Promise<TabletAccessRecord | null>; write: (record: TabletAccessRecord) => Promise<void>;
    remove: () => Promise<void> };
  api: typeof tabletAccessApi;
  readLegacyPairing: () => Promise<PairedDevice | null>;
  removeLegacyPairing: () => Promise<void>;
  generatePassword: () => Promise<string>;
  wait: (ms: number) => Promise<void>;
  isCancelled: () => boolean;
  onUpdate: (update: AccessUpdate) => void;
}

export class AccessCancelled extends Error {}

const failure = (result: { status: number; code?: string }) =>
  new Error(`The FIELD service refused the tablet (HTTP ${result.status}${result.code ? `, ${result.code}` : ''}).`);

// Runs until the tablet holds a device token, following the tablet access
// contract: register once, poll while unassigned, then create a session.
const runTabletAccess = async (deps: AccessDeps): Promise<TabletAccessRecord> => {
  const { store, api, onUpdate } = deps;
  const pause = async (ms: number) => {
    if (deps.isCancelled()) throw new AccessCancelled();
    await deps.wait(ms);
    if (deps.isCancelled()) throw new AccessCancelled();
  };
  const call = async <Value>(attempt: () => Promise<ApiResult<Value>>, update: AccessUpdate) => {
    for (let tries = 0; ; tries++) {
      const result = await attempt();
      if (result.kind !== 'retry') return result;
      onUpdate({ ...update, notice: 'Cannot reach FIELD. Retrying…' });
      await pause(result.retryAfterMs ?? BACKOFF_MS[Math.min(tries, BACKOFF_MS.length - 1)] ?? 30000);
    }
  };

  const register = async (): Promise<TabletAccessRecord> => {
    const legacy = await deps.readLegacyPairing().catch(() => null);
    const password = await deps.generatePassword();
    onUpdate({ phase: 'registering' });
    let result = await call(() => api.register(password, legacy?.deviceToken), { phase: 'registering' });
    let isUpgrade = Boolean(legacy);
    if (result.kind === 'error' && legacy && result.code === 'tablet_device_token_invalid') {
      isUpgrade = false;
      result = await call(() => api.register(password), { phase: 'registering' });
    }
    if (result.kind === 'error') throw failure(result);
    if (!result.value) throw new Error('The FIELD service returned no registration.');
    const record: TabletAccessRecord = {
      version: 1, fieldId: result.value.fieldId, tabletToken: result.value.tabletToken, password,
      // An upgraded tablet keeps its machine; its password cannot be changed here, so keep showing it.
      ...(isUpgrade && legacy ? { device: legacy, isPasswordUnconfirmed: true } : {}),
    };
    // Persist the reply before anything else: a lost reply means a new FIELD ID.
    await store.write(record);
    if (legacy) await deps.removeLegacyPairing().catch(() => undefined);
    return record;
  };

  for (;;) {
    const record = (await store.read()) ?? await register();
    if (record.device) return record;
    onUpdate({ phase: 'waiting', record });
    const registration = await call(() => api.getRegistration(record.tabletToken), { phase: 'waiting', record });
    if (registration.kind === 'error') {
      if (registration.code !== 'TABLET_TOKEN_INVALID') throw failure(registration);
      await store.remove(); // Registration replaced: register again with a new FIELD ID.
      continue;
    }
    if (!registration.value?.assigned) {
      await pause(POLL_MS);
      continue;
    }
    onUpdate({ phase: 'connecting', record });
    const session = await call(() => api.createSession(record.tabletToken), { phase: 'connecting', record });
    if (session.kind === 'error') {
      if (session.code === 'TABLET_TOKEN_INVALID') await store.remove();
      else if (session.code !== 'tablet_not_assigned') throw failure(session);
      continue;
    }
    if (!session.value) throw new Error('The FIELD service returned no device session.');
    const paired: TabletAccessRecord = {
      ...record,
      device: session.value,
      // The Portal user who added the tablet typed this password; stop storing it.
      password: record.isPasswordUnconfirmed ? record.password : undefined,
    };
    await store.write(paired);
    return paired;
  }
};

export default runTabletAccess;

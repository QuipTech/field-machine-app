import type tabletAccessApi from '../../services/tabletAccessApi';
import runTabletAccess, { type AccessDeps } from './runTabletAccess';
import type { TabletAccessRecord } from './tabletAccessSchema';

const TOKEN = 'a'.repeat(43);
const NEW_TOKEN = 'b'.repeat(43);
const device = {
  deviceId: 'b71d4c0e-2a95-4f3a-8c61-0d9e5b4a7c22',
  deviceToken: 'c'.repeat(43),
  machine: { id: '3f0c9a52-8f4e-4d57-9d0b-5a1c2e7b9f10', label: 'EX-204' },
};
const legacy = { ...device, deviceToken: 'd'.repeat(43) };
const machine = { id: device.machine.id, label: 'EX-204' };

const setup = (api: Partial<typeof tabletAccessApi>, saved: TabletAccessRecord | null = null,
  legacyPairing: typeof legacy | null = null) => {
  let stored = saved;
  const writes: TabletAccessRecord[] = [];
  const deps: AccessDeps = {
    store: {
      read: async () => stored,
      write: async record => { stored = record; writes.push(record); },
      remove: async () => { stored = null; },
    },
    api: api as typeof tabletAccessApi,
    readLegacyPairing: async () => legacyPairing,
    removeLegacyPairing: jest.fn(async () => undefined),
    generatePassword: () => 'Rk7p-Q2mW-x9tH',
    wait: async () => undefined,
    isCancelled: () => false,
    onUpdate: jest.fn(),
  };
  return { deps, writes };
};

test('registers once, persists, polls until added, then drops the password', async () => {
  const getRegistration = jest.fn()
    .mockResolvedValueOnce({ kind: 'retry' })
    .mockResolvedValueOnce({ kind: 'ok', value: { fieldId: '482915307', assigned: false, machine: null } })
    .mockResolvedValueOnce({ kind: 'ok', value: { fieldId: '482915307', assigned: true, machine } });
  const { deps, writes } = setup({
    register: jest.fn().mockResolvedValue({ kind: 'ok', value: { fieldId: '482915307', tabletToken: TOKEN } }),
    getRegistration,
    createSession: jest.fn().mockResolvedValue({ kind: 'ok', value: device }),
  });
  const record = await runTabletAccess(deps);
  expect(deps.api.register).toHaveBeenCalledWith('Rk7p-Q2mW-x9tH', undefined);
  expect(writes[0]).toMatchObject({ fieldId: '482915307', tabletToken: TOKEN, password: 'Rk7p-Q2mW-x9tH' });
  expect(getRegistration).toHaveBeenCalledTimes(3);
  expect(record.device).toEqual(device);
  expect(record.password).toBeUndefined();
});

test('upgrades a code-paired tablet and keeps its machine and password for the installer', async () => {
  const { deps } = setup({
    register: jest.fn().mockResolvedValue({ kind: 'ok', value: { fieldId: '482915307', tabletToken: TOKEN } }),
  }, null, legacy);
  const record = await runTabletAccess(deps);
  expect(deps.api.register).toHaveBeenCalledWith('Rk7p-Q2mW-x9tH', legacy.deviceToken);
  expect(record).toMatchObject({ device: legacy, password: 'Rk7p-Q2mW-x9tH', isPasswordUnconfirmed: true });
  expect(deps.removeLegacyPairing).toHaveBeenCalled();
});

test('registers without the device token when the upgrade token is dead', async () => {
  const register = jest.fn()
    .mockResolvedValueOnce({ kind: 'error', status: 403, code: 'tablet_device_token_invalid' })
    .mockResolvedValueOnce({ kind: 'ok', value: { fieldId: '482915307', tabletToken: TOKEN } });
  const { deps } = setup({
    register,
    getRegistration: jest.fn().mockResolvedValue({ kind: 'ok', value: { fieldId: '482915307', assigned: true, machine } }),
    createSession: jest.fn().mockResolvedValue({ kind: 'ok', value: device }),
  }, null, legacy);
  const record = await runTabletAccess(deps);
  expect(register).toHaveBeenLastCalledWith('Rk7p-Q2mW-x9tH');
  expect(record.device).toEqual(device);
});

test('registers again with a new FIELD ID when the tablet token is replaced', async () => {
  const saved = { version: 1 as const, fieldId: '111111111', tabletToken: TOKEN };
  const { deps } = setup({
    register: jest.fn().mockResolvedValue({ kind: 'ok', value: { fieldId: '482915307', tabletToken: NEW_TOKEN } }),
    getRegistration: jest.fn()
      .mockResolvedValueOnce({ kind: 'error', status: 401, code: 'TABLET_TOKEN_INVALID' })
      .mockResolvedValueOnce({ kind: 'ok', value: { fieldId: '482915307', assigned: true, machine } }),
    createSession: jest.fn().mockResolvedValue({ kind: 'ok', value: device }),
  }, saved);
  const record = await runTabletAccess(deps);
  expect(record.fieldId).toBe('482915307');
  expect(deps.api.createSession).toHaveBeenCalledWith(NEW_TOKEN);
});

test('stops on an unexpected refusal instead of retrying', async () => {
  const saved = { version: 1 as const, fieldId: '111111111', tabletToken: TOKEN };
  const { deps } = setup({
    getRegistration: jest.fn().mockResolvedValue({ kind: 'error', status: 403, code: 'forbidden' }),
  }, saved);
  await expect(runTabletAccess(deps)).rejects.toThrow('HTTP 403, forbidden');
});

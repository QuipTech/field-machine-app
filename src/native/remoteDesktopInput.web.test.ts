import request from './ltscNativeRequest';
import remoteDesktopInput from './remoteDesktopInput.web';

jest.mock('./ltscNativeRequest', () => jest.fn(async () => true));

const lastArguments = () => jest.mocked(request).mock.calls.at(-1)?.[3];

beforeEach(() => jest.clearAllMocks());

test('forwards pointer and key input with the session owner', async () => {
  await remoteDesktopInput.apply('owner', { v: 1, type: 'pointer', action: 'down', x: 0.5, y: 0.25, button: 0 });
  expect(lastArguments()).toMatchObject({ owner: 'owner', kind: 'pointer', action: 'down', x: 0.5, y: 0.25 });
  await remoteDesktopInput.apply('owner', {
    v: 1, type: 'key', action: 'down', key: 'a', code: 'KeyA', alt: false, ctrl: false, shift: false, meta: false,
  });
  expect(lastArguments()).toMatchObject({ kind: 'key', action: 'down', value: 'KeyA' });
});

test('blocks Ctrl+Alt+Delete before it reaches Windows', async () => {
  const applied = await remoteDesktopInput.apply('owner', {
    v: 1, type: 'key', action: 'down', key: 'Delete', code: 'Delete', alt: true, ctrl: true, shift: false, meta: false,
  });
  expect(applied).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

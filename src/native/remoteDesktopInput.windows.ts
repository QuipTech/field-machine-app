import { NativeModules } from 'react-native';
import type { RemoteInput } from '../features/remote-support/remoteInputSchema';

interface RemoteDesktopInput {
  start: (owner: string) => Promise<boolean>;
  reset: (owner: string, end: boolean) => void;
  apply: (
    owner: string, kind: string, action: string, x: number, y: number,
    first: number, second: number, value: string,
  ) => Promise<boolean>;
}

const nativeInput: RemoteDesktopInput | undefined = NativeModules.FieldMachineRemoteDesktopInput;

const apply = async (owner: string, input: RemoteInput) => {
  if (!nativeInput) {
    return false;
  }
  switch (input.type) {
    case 'pointer':
      return nativeInput.apply(owner, input.type, input.action, input.x, input.y, input.button, 0, '');
    case 'wheel':
      return nativeInput.apply(owner, input.type, '', input.x, input.y, input.deltaX, input.deltaY, '');
    case 'key':
      if (input.code === 'Delete' && input.alt && input.ctrl) {
        return false;
      }
      return nativeInput.apply(owner, input.type, input.action, 0, 0, 0, 0, input.code);
    case 'text':
      return nativeInput.apply(owner, input.type, '', 0, 0, 0, 0, input.text);
  }
};

const remoteDesktopInput = {
  apply,
  start: (owner: string) => nativeInput?.start(owner) ?? Promise.resolve(false),
  reset: (owner: string, end: boolean) => nativeInput?.reset(owner, end),
};

export default remoteDesktopInput;

import { z } from 'zod';
import type { RemoteInput } from '../features/remote-support/remoteInputSchema';
import ltscNativeRequest from './ltscNativeRequest';

const request = (operation: string, args: Record<string, string | number>) =>
  ltscNativeRequest('field-input', operation, z.boolean(), args);

const apply = async (owner: string, input: RemoteInput) => {
  const base = { owner, kind: input.type, action: '', x: 0, y: 0, first: 0, second: 0, value: '' };
  switch (input.type) {
    case 'pointer':
      return request('apply', { ...base, action: input.action, x: input.x, y: input.y, first: input.button });
    case 'wheel':
      return request('apply', { ...base, x: input.x, y: input.y, first: input.deltaX, second: input.deltaY });
    case 'key':
      if (input.code === 'Delete' && input.alt && input.ctrl) return false;
      return request('apply', { ...base, action: input.action, value: input.code });
    case 'text':
      return request('apply', { ...base, value: input.text });
  }
};

const remoteDesktopInput = {
  apply,
  start: (owner: string) => request('start', { owner }),
  reset: (owner: string, end: boolean) => {
    request(end ? 'end' : 'release', { owner }).catch(() => undefined);
  },
};

export default remoteDesktopInput;

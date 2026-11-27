import desktopHost, { type DesktopEvent } from './desktopHost';

type Handler = (event: { data: unknown }) => void;
const handlers: Handler[] = [];
const runtime = globalThis as { chrome?: unknown };

beforeEach(() => {
  handlers.length = 0;
  runtime.chrome = {
    webview: {
      postMessage: jest.fn(),
      addEventListener: (_type: string, handler: Handler) => handlers.push(handler),
      removeEventListener: (_type: string, handler: Handler) => {
        handlers.splice(handlers.indexOf(handler), 1);
      },
    },
  };
});

afterEach(() => {
  delete runtime.chrome;
});

const emit = (data: unknown) => handlers.forEach(handler => handler({ data }));

test('accepts only valid desktop service events', () => {
  const events: DesktopEvent[] = [];
  const stop = desktopHost.onEvent(event => events.push(event));
  emit({ type: 'field-desktop-event', event: 'stop' });
  emit({ type: 'field-desktop-event', event: 'mic', on: true });
  emit({
    type: 'field-desktop-event', event: 'file-staged',
    transferId: 'a2b1c3d4-1234-4123-8123-123456789012', fileName: 'report.pdf',
  });
  emit({ type: 'field-desktop-event', event: 'file-staged', transferId: '../x', fileName: 'a.pdf' });
  emit({ type: 'field-desktop-event', event: 'unknown' });
  emit({ type: 'field-portal-progress', event: 'stop' });
  stop();
  emit({ type: 'field-desktop-event', event: 'ended' });
  expect(events.map(event => event.event)).toEqual(['stop', 'mic', 'file-staged']);
});

test('passes frames and ignores other messages', () => {
  const frames: string[] = [];
  const stop = desktopHost.onFrame(frame => frames.push(frame));
  emit({ type: 'field-desktop-frame', data: 'AAEC' });
  emit({ type: 'field-desktop-frame', data: '' });
  emit({ type: 'field-desktop-event', event: 'stop' });
  stop();
  expect(frames).toEqual(['AAEC']);
});

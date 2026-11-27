import { z } from 'zod';
import ltscNativeRequest from './ltscNativeRequest';
import getLtscWebView from './ltscWebView';

// Bridge to the FIELD Machine Desktop service (Windows LTSC build only). The
// service shares whichever Windows user is on screen and shows the support panel.
const service = 'field-desktop';

const frameSchema = z.object({ type: z.literal('field-desktop-frame'), data: z.string().min(1) });
const envelopeSchema = z.object({ type: z.literal('field-desktop-event') });
const eventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('started'), control: z.boolean().optional() }),
  z.object({ event: z.enum(['denied', 'ended', 'stop']) }),
  z.object({ event: z.literal('mic'), on: z.boolean() }),
  z.object({
    event: z.literal('file-staged'),
    transferId: z.string().uuid(),
    fileName: z.string().min(1).max(200),
  }),
  z.object({ event: z.literal('file-rejected'), fileName: z.string().min(1).max(200) }),
]);

export type DesktopEvent = z.infer<typeof eventSchema>;

const listen = (onMessage: (data: unknown) => void) => {
  const view = getLtscWebView();
  if (!view) return () => undefined;
  const handler = (event: { data: unknown }) => onMessage(event.data);
  view.subscribe('message', handler);
  return () => view.unsubscribe('message', handler);
};

const desktopHost = {
  isSupported: Boolean(getLtscWebView()),
  // 'service': the installed service shares whichever Windows user is on screen.
  // 'local': no service, so the app shares only its own Windows user.
  // null: no whole-screen source; use the screen picker.
  start: (token: string, sessionId: string, pairing: string) =>
    ltscNativeRequest(service, 'start', z.enum(['service', 'local']), { token, sessionId, pairing }, 15000)
      .catch(() => null),
  stop: () => ltscNativeRequest(service, 'stop', z.null(), {}, 10000)
    .then(() => undefined, () => undefined),
  notify: (text: string) => ltscNativeRequest(service, 'notify', z.boolean(), { text })
    .catch(() => false),
  onFrame: (listener: (jpegBase64: string) => void) => listen(data => {
    const frame = frameSchema.safeParse(data);
    if (frame.success) listener(frame.data.data);
  }),
  onEvent: (listener: (event: DesktopEvent) => void) => listen(data => {
    if (!envelopeSchema.safeParse(data).success) return;
    const event = eventSchema.safeParse(data);
    if (event.success) listener(event.data);
  }),
};

export default desktopHost;

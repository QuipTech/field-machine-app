import { z } from 'zod';

const point = { x: z.number().min(0).max(1), y: z.number().min(0).max(1) };
const remoteInputSchema = z.discriminatedUnion('type', [
  z.object({
    v: z.literal(1), type: z.literal('pointer'), ...point,
    action: z.enum(['down', 'move', 'up', 'cancel']),
    button: z.number().int().min(0).max(2),
  }),
  z.object({
    v: z.literal(1), type: z.literal('wheel'), ...point,
    deltaX: z.number().min(-2400).max(2400), deltaY: z.number().min(-2400).max(2400),
  }),
  z.object({
    v: z.literal(1), type: z.literal('key'), action: z.enum(['down', 'up']),
    key: z.string().max(64), code: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/),
    alt: z.boolean(), ctrl: z.boolean(), shift: z.boolean(), meta: z.boolean(),
  }),
  z.object({
    v: z.literal(1), type: z.literal('text'), text: z.string().min(1).max(2048),
  }),
]);

export type RemoteInput = z.infer<typeof remoteInputSchema>;
export default remoteInputSchema;

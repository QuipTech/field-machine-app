import { z } from 'zod';

const pairingCodeSchema = z
  .string()
  .transform(value => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^[0-9]{6}$/, 'Enter the six-digit pairing code.'));

const pairingSchema = z.object({
  deviceId: z.string().uuid(),
  deviceToken: z
    .string()
    .min(1)
    .max(16000)
    .regex(/^[A-Za-z0-9_-]+$/),
  machine: z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(500),
  }),
});

export type PairedDevice = z.infer<typeof pairingSchema>;
export { pairingCodeSchema };
export default pairingSchema;

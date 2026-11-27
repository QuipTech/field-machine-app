import { z } from 'zod';
import pairingSchema from '../pairing/pairingSchema';

// Contract: 9 digits, first digit 1–9. Tokens are 43 base64url characters;
// a wider range tolerates a format change without accepting arbitrary text.
export const fieldIdSchema = z.string().regex(/^[1-9][0-9]{8}$/);
const tokenSchema = z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const tabletPasswordSchema = z.string().min(8).max(128);

export const registerResponseSchema = z.object({
  fieldId: fieldIdSchema,
  tabletToken: tokenSchema,
});

export const registrationSchema = z.object({
  fieldId: fieldIdSchema,
  assigned: z.boolean(),
  machine: z.object({ id: z.string().uuid(), label: z.string().min(1).max(500) }).nullable(),
});

// The same keys as code pairing, so the rest of the app is unchanged.
export const sessionResponseSchema = pairingSchema;

export const accessRecordSchema = z.object({
  version: z.literal(1),
  fieldId: fieldIdSchema,
  tabletToken: tokenSchema,
  // Kept only until a Portal user has added the tablet (or, after an upgrade,
  // until the operator confirms it was recorded).
  password: tabletPasswordSchema.optional(),
  isPasswordUnconfirmed: z.boolean().optional(),
  device: pairingSchema.optional(),
});

export type TabletAccessRecord = z.infer<typeof accessRecordSchema>;
export type TabletRegistration = z.infer<typeof registrationSchema>;

// Shows the FIELD ID in groups of three, as the Portal accepts spaces.
export const formatFieldId = (fieldId: string) => fieldId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

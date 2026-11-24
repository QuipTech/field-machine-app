import { z } from 'zod';

export const pendingSchema = z.array(
  z.object({ id: z.string().uuid(), fileName: z.string().min(1) }),
);
export const responseSchema = z.object({ status: z.number().int(), body: z.string() });
export const uploadProgressSchema = z.object({ id: z.string(), percent: z.number() });

import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const deliverySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  project: z.string().min(1),
  versionId: z.string().uuid(),
  status: z.enum(['waiting', 'downloading']),
  files: z.array(fileSchema),
});

const projectSchema = deliverySchema.pick({ id: true, projectId: true, project: true, versionId: true });
const terminalSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('arrived') }),
  z.object({ status: z.literal('failed'), error: z.string().min(1) }),
]);

export const journalSchema = z.object({
  projects: z.array(projectSchema),
  pending: z.object({ id: z.string().uuid(), result: terminalSchema }).nullable(),
});

export type Journal = z.infer<typeof journalSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type Status = z.infer<typeof terminalSchema> | { status: 'downloading' };
export type ActiveProject = z.infer<typeof projectSchema>;

export default deliverySchema;

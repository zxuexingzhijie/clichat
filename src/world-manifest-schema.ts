import { z } from 'zod';

const semverRegex = /^\d+\.\d+\.\d+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const WorldManifestSchema = z.object({
  version: z.string().regex(semverRegex),
  gameVersion: z.string().regex(semverRegex),
  generatedAt: z.string().regex(dateRegex).optional(),
  worldDataSchema: z.literal('2.0.0'),
  migration: z.literal('world-data-authoring-v2'),
}).strict();

export type WorldManifest = z.infer<typeof WorldManifestSchema>;

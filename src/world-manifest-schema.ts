import { z } from 'zod';

export const WorldManifestSchema = z.object({
  version: z.string(),
  gameVersion: z.string(),
  generatedAt: z.string().optional(),
});

export type WorldManifest = z.infer<typeof WorldManifestSchema>;

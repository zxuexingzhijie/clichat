import { z } from 'zod';

export const ModelPricingSchema = z.object({
  price_per_1k_input_tokens: z.number().optional(),
  price_per_1k_output_tokens: z.number().optional(),
});

export const RoleConfigEntrySchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  pricing: ModelPricingSchema.optional(),
});

export const ProfileSchema = z.object({
  roles: z.record(z.string(), RoleConfigEntrySchema),
});

export const AiConfigSchema = z.object({
  default_profile: z.string().default('balanced'),
  profiles: z.record(z.string(), ProfileSchema),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;
export type RoleConfigEntry = z.infer<typeof RoleConfigEntrySchema>;
export type ModelPricing = z.infer<typeof ModelPricingSchema>;

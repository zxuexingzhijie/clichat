import { parse as parseYaml } from "yaml";
import { z } from "zod";

const DialogueOptionEffectSchema = z.object({
  raceId: z.string().optional(),
  professionWeights: z.record(z.string(), z.number()).default({}),
  backgroundWeights: z.record(z.string(), z.number()).default({}),
  tags: z.array(z.string()).default([]),
});

const DialogueOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  effects: DialogueOptionEffectSchema,
});

const DialogueRoundSchema = z.object({
  round: z.number().int().min(1).max(4),
  guardPromptHint: z.string().min(1),
  options: z.array(DialogueOptionSchema).min(2),
});

export const GuardDialogueConfigSchema = z.object({
  rounds: z.array(DialogueRoundSchema).length(4),
  archetypePriority: z.object({
    profession: z.array(z.string()).min(1),
    background: z.array(z.string()).min(1),
  }),
  namePool: z.array(z.string()).min(1),
});

export type GuardDialogueConfig = z.infer<typeof GuardDialogueConfigSchema>;
export type DialogueOption = z.infer<typeof DialogueOptionSchema>;
export type DialogueRound = z.infer<typeof DialogueRoundSchema>;
export type DialogueOptionEffect = z.infer<typeof DialogueOptionEffectSchema>;

export async function loadGuardDialogue(
  filePath: string,
): Promise<GuardDialogueConfig> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const raw = parseYaml(text);

  const result = GuardDialogueConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Guard dialogue file ${filePath} validation failed:\n${issues}`,
    );
  }

  return result.data;
}

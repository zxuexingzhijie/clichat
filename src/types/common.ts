import { z } from 'zod';

export const EntityIdSchema = z.string().min(1);
export type EntityId = z.infer<typeof EntityIdSchema>;

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const AttributeNameSchema = z.enum(['physique', 'finesse', 'mind']);
export type AttributeName = z.infer<typeof AttributeNameSchema>;

export const ATTRIBUTE_LABELS: Record<AttributeName, string> = {
  physique: '体魄',
  finesse: '技巧',
  mind: '心智',
};

export const SuccessGradeSchema = z.enum([
  'critical_success',
  'great_success',
  'success',
  'partial_success',
  'failure',
  'critical_failure',
]);
export type SuccessGrade = z.infer<typeof SuccessGradeSchema>;

export const GRADE_LABELS: Record<SuccessGrade, string> = {
  critical_success: '大成功！',
  great_success: '出色成功！',
  success: '成功！',
  partial_success: '勉强成功',
  failure: '失败',
  critical_failure: '大失败！',
};

export const AdjudicationModeSchema = z.enum([
  'normal',
  'opposed',
  'probability',
  'plot_critical',
]);
export type AdjudicationMode = z.infer<typeof AdjudicationModeSchema>;

export const CheckResultSchema = z.object({
  roll: z.number().int().min(1).max(20),
  attributeName: AttributeNameSchema,
  attributeModifier: z.number(),
  skillModifier: z.number(),
  environmentModifier: z.number(),
  total: z.number(),
  dc: z.number(),
  grade: SuccessGradeSchema,
  display: z.string(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const DamageResultSchema = z.object({
  weaponBase: z.number(),
  attributeModifier: z.number(),
  gradeBonus: z.number(),
  armorReduction: z.number(),
  total: z.number(),
  display: z.string(),
});
export type DamageResult = z.infer<typeof DamageResultSchema>;

export const TimeOfDaySchema = z.enum(['dawn', 'day', 'dusk', 'night', 'midnight']);
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  dawn: '黎明',
  day: '白天',
  dusk: '黄昏',
  night: '夜晚',
  midnight: '深夜',
};

export const SceneTypeSchema = z.enum(['exploration', 'combat', 'dialogue', 'lore', 'horror', 'check_result']);
export type SceneType = z.infer<typeof SceneTypeSchema>;

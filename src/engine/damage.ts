import type { DamageParams } from "./types.ts";
import type { DamageResult, SuccessGrade } from "../types/common.ts";

const GRADE_BONUS: Record<SuccessGrade, number> = {
  critical_success: 4,
  great_success: 3,
  success: 2,
  partial_success: 1,
  failure: 0,
  critical_failure: 0,
};

export function getGradeBonus(grade: SuccessGrade): number {
  return GRADE_BONUS[grade];
}

export function calculateDamage(params: DamageParams): DamageResult {
  const { weaponBase, attributeModifier, grade, armorReduction } = params;
  const gradeBonus = getGradeBonus(grade);
  const total = Math.max(0, weaponBase + attributeModifier + gradeBonus - armorReduction);
  const display = `${weaponBase}(武器) + ${attributeModifier}(属性) + ${gradeBonus}(等级) - ${armorReduction}(护甲) = ${total}`;

  return {
    weaponBase,
    attributeModifier,
    gradeBonus,
    armorReduction,
    total,
    display,
  };
}

import type { AttributeName, SuccessGrade } from "../types/common.ts";

export interface CheckParams {
  roll: number;
  attributeName: AttributeName;
  attributeModifier: number;
  skillModifier: number;
  environmentModifier: number;
  dc: number;
}

export interface OpposedCheckParams {
  attacker: Omit<CheckParams, "dc">;
  defender: Omit<CheckParams, "dc">;
}

export interface ProbabilityCheckParams {
  threshold: number;
  roll?: number;
}

export interface DamageParams {
  weaponBase: number;
  attributeModifier: number;
  grade: SuccessGrade;
  armorReduction: number;
}

import type { CheckParams, OpposedCheckParams, ProbabilityCheckParams } from "./types.ts";
import type { CheckResult, SuccessGrade } from "../types/common.ts";
import { GRADE_LABELS, ATTRIBUTE_LABELS } from "../types/common.ts";
import { rollD20, rollPercentage } from "./dice.ts";

function gradeFromRoll(roll: number, total: number, dc: number): SuccessGrade {
  if (roll === 20) return "critical_success";
  if (roll === 1) return "critical_failure";
  if (total >= dc + 10) return "great_success";
  if (total >= dc) return "success";
  if (total >= dc - 5) return "partial_success";
  return "failure";
}

function buildDisplay(roll: number, attributeName: string, attrMod: number, total: number, dc: number, grade: SuccessGrade): string {
  const attrLabel = ATTRIBUTE_LABELS[attributeName as keyof typeof ATTRIBUTE_LABELS] ?? attributeName;
  const gradeLabel = GRADE_LABELS[grade];
  if (roll === 20) return `[D20: 20] -> ${gradeLabel}`;
  if (roll === 1) return `[D20: 1] -> ${gradeLabel}`;
  return `[D20: ${roll}] + ${attrLabel} ${attrMod} = ${total} vs DC ${dc} -> ${gradeLabel}`;
}

export function resolveNormalCheck(params: CheckParams): CheckResult {
  const { roll, attributeName, attributeModifier, skillModifier, environmentModifier, dc } = params;
  const total = roll + attributeModifier + skillModifier + environmentModifier;
  const grade = gradeFromRoll(roll, total, dc);
  const display = buildDisplay(roll, attributeName, attributeModifier, total, dc, grade);

  return {
    roll,
    attributeName,
    attributeModifier,
    skillModifier,
    environmentModifier,
    total,
    dc,
    grade,
    display,
  };
}

export interface OpposedResult {
  attacker: CheckResult;
  defender: CheckResult;
  winner: "attacker" | "defender";
}

export function resolveOpposedCheck(params: OpposedCheckParams, rng?: () => number): OpposedResult {
  const attackerRoll = rollD20(rng);
  const defenderRoll = rollD20(rng);

  const attacker = resolveNormalCheck({
    ...params.attacker,
    roll: attackerRoll,
    dc: 0,
  });
  const defender = resolveNormalCheck({
    ...params.defender,
    roll: defenderRoll,
    dc: 0,
  });

  const attackerTotal = attacker.total;
  const defenderTotal = defender.total;
  const winner = attackerTotal > defenderTotal ? "attacker" : "defender";

  return { attacker, defender, winner };
}

export interface ProbabilityResult {
  roll: number;
  threshold: number;
  success: boolean;
}

export function resolveProbabilityCheck(params: ProbabilityCheckParams, rng?: () => number): ProbabilityResult {
  const roll = params.roll ?? rollPercentage(rng);
  return {
    roll,
    threshold: params.threshold,
    success: roll <= params.threshold,
  };
}

export interface PlotCriticalResult extends CheckResult {
  narrativeHint: string;
}

function narrativeHintForGrade(grade: SuccessGrade): string {
  switch (grade) {
    case "critical_success": return "描述一个超越预期的精彩结果，带来意外收获";
    case "great_success": return "描述一个令人满意的结果，计划完美执行";
    case "success": return "描述一个正常的成功结果";
    case "partial_success": return "描述一个勉强的结果，附带小代价或不完美";
    case "failure": return "描述一个失败结果，但不致命";
    case "critical_failure": return "描述一个灾难性的失败，带来严重后果";
  }
}

export function resolvePlotCriticalCheck(params: CheckParams): PlotCriticalResult {
  const result = resolveNormalCheck(params);
  return {
    ...result,
    narrativeHint: narrativeHintForGrade(result.grade),
  };
}

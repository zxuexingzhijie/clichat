import type { GameAction } from "../types/game-action.ts";
import type { AttributeName, CheckResult } from "../types/common.ts";
import { resolveNormalCheck } from "./adjudication.ts";
import { rollD20 } from "./dice.ts";
import { sentimentToDelta } from "./reputation-system.ts";
import type { NpcSentiment } from "../ai/schemas/npc-dialogue.ts";

export interface ActionContext {
  attributeModifier: number;
  skillModifier: number;
  environmentModifier: number;
  dc: number;
  attributeName: AttributeName;
}

export function resolveAction(
  _action: GameAction,
  context: ActionContext,
  rng?: () => number,
): CheckResult {
  const roll = rollD20(rng);
  return resolveNormalCheck({
    roll,
    attributeName: context.attributeName,
    attributeModifier: context.attributeModifier,
    skillModifier: context.skillModifier,
    environmentModifier: context.environmentModifier,
    dc: context.dc,
  });
}

export type TalkResult = {
  readonly relationshipDelta: number;
};

export function adjudicateTalkResult(sentiment: NpcSentiment): TalkResult {
  return { relationshipDelta: sentimentToDelta(sentiment) };
}

import type { ActionHandler } from './types';
import { getCostSummary } from '../../state/cost-session-store';

export const handleCost: ActionHandler = async (action) => {
  const summary = getCostSummary();
  const lines: string[] = [
    `【本次冒险消耗】`,
    `  总 Input: ${summary.totalInputTokens} tokens`,
    `  总 Output: ${summary.totalOutputTokens} tokens`,
    `  估算费用: $${summary.totalEstimatedCost.toFixed(6)}`,
    ``,
    `【各 AI 角色消耗】`,
    ...Object.entries(summary.byRole).map(([role, entry]) =>
      entry ? `  ${role}: in=${entry.inputTokens} out=${entry.outputTokens} $${entry.estimatedCost.toFixed(6)}` : ''
    ).filter(Boolean),
  ];
  return { status: 'action_executed', action, narration: lines };
};

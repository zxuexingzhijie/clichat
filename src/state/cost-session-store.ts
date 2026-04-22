import { createStore } from './create-store';
import { eventBus } from '../events/event-bus';
import { getRoleConfig, type AiRole } from '../ai/providers';

export type RoleCostEntry = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
};

export type CostSessionState = {
  readonly byRole: Partial<Record<AiRole, RoleCostEntry>>;
  readonly lastTurnTokens: number;
};

export type CostSummary = {
  readonly byRole: Partial<Record<AiRole, RoleCostEntry>>;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalEstimatedCost: number;
  readonly lastTurnTokens: number;
};

type PricingInfo = {
  price_per_1k_input_tokens?: number;
  price_per_1k_output_tokens?: number;
};

function getDefaultState(): CostSessionState {
  return { byRole: {}, lastTurnTokens: 0 };
}

export const costSessionStore = createStore<CostSessionState>(
  getDefaultState(),
  ({ newState }) => {
    eventBus.emit('token_usage_updated', { lastTurnTokens: newState.lastTurnTokens });
  },
);

export function recordUsage(
  role: AiRole,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
): void {
  const config = getRoleConfig(role) as ReturnType<typeof getRoleConfig> & { pricing?: PricingInfo };
  const pricing = config.pricing;
  const inputCost =
    pricing?.price_per_1k_input_tokens != null
      ? (usage.inputTokens / 1000) * pricing.price_per_1k_input_tokens
      : 0;
  const outputCost =
    pricing?.price_per_1k_output_tokens != null
      ? (usage.outputTokens / 1000) * pricing.price_per_1k_output_tokens
      : 0;
  const delta = inputCost + outputCost;

  costSessionStore.setState((draft) => {
    const existing = draft.byRole[role] ?? { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
    draft.byRole[role] = {
      inputTokens: existing.inputTokens + usage.inputTokens,
      outputTokens: existing.outputTokens + usage.outputTokens,
      estimatedCost: existing.estimatedCost + delta,
    };
    draft.lastTurnTokens = usage.totalTokens;
  });
}

export function getCostSummary(): CostSummary {
  const state = costSessionStore.getState();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedCost = 0;

  for (const entry of Object.values(state.byRole)) {
    if (entry) {
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      totalEstimatedCost += entry.estimatedCost;
    }
  }

  return {
    byRole: state.byRole,
    totalInputTokens,
    totalOutputTokens,
    totalEstimatedCost,
    lastTurnTokens: state.lastTurnTokens,
  };
}

export function resetCostSession(): void {
  costSessionStore.setState((draft) => {
    draft.byRole = {};
    draft.lastTurnTokens = 0;
  });
}

// Auto-reset on game load so previous session costs don't bleed in
eventBus.on('state_restored', () => { resetCostSession(); });

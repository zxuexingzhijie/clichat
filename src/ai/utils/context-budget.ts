type RoleConfigLike = {
  readonly maxTokens: number;
};

export type ContextBudgetOptions = {
  readonly contextMultiplier?: number;
  readonly reservedTokens?: number;
  readonly maxBudget?: number;
};

export function getContextBudgetForRole(
  roleConfig: RoleConfigLike,
  options: ContextBudgetOptions = {},
): number {
  const multiplier = options.contextMultiplier ?? 4;
  const reserved = options.reservedTokens ?? 0;
  const derived = Math.max(0, Math.floor(roleConfig.maxTokens * multiplier - reserved));
  return options.maxBudget === undefined ? derived : Math.min(derived, options.maxBudget);
}

export type ContextSelectionOptions<T> = {
  readonly estimate: (item: T) => number;
  readonly maxBudget: number;
  readonly getId: (item: T) => string;
  readonly getPriority?: (item: T) => number;
};

export type ContextSelectionResult<T> = {
  readonly selectedItems: readonly T[];
  readonly omittedIds: readonly string[];
  readonly totalEstimate: number;
  readonly selectedEstimate: number;
};

export function selectContextItems<T>(
  items: readonly T[],
  options: ContextSelectionOptions<T>,
): ContextSelectionResult<T> {
  const estimates = items.map((item) => Math.max(0, Math.ceil(options.estimate(item))));
  const totalEstimate = estimates.reduce((sum, value) => sum + value, 0);

  if (totalEstimate <= options.maxBudget) {
    return {
      selectedItems: items,
      omittedIds: [],
      totalEstimate,
      selectedEstimate: totalEstimate,
    };
  }

  const ranked = items.map((item, index) => ({
    item,
    index,
    estimate: estimates[index] ?? 0,
    priority: options.getPriority?.(item) ?? 0,
  })).sort((a, b) => {
    const priorityDelta = b.priority - a.priority;
    if (priorityDelta !== 0) return priorityDelta;
    return b.index - a.index;
  });

  let remaining = Math.max(0, Math.floor(options.maxBudget));
  const selectedIndexes = new Set<number>();
  for (const candidate of ranked) {
    if (candidate.estimate <= remaining) {
      selectedIndexes.add(candidate.index);
      remaining -= candidate.estimate;
    }
  }

  const selectedItems = items.filter((_, index) => selectedIndexes.has(index));
  const omittedIds = items
    .filter((_, index) => !selectedIndexes.has(index))
    .map((item) => options.getId(item));

  return {
    selectedItems,
    omittedIds,
    totalEstimate,
    selectedEstimate: Math.max(0, Math.floor(options.maxBudget) - remaining),
  };
}

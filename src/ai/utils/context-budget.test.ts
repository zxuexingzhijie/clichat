import { describe, it, expect } from 'bun:test';
import { getContextBudgetForRole, selectContextItems } from './context-budget';

describe('getContextBudgetForRole', () => {
  it('derives budget from role maxTokens rather than model name', () => {
    const first = getContextBudgetForRole({ maxTokens: 100 }, { contextMultiplier: 3 });
    const second = getContextBudgetForRole({ maxTokens: 200 }, { contextMultiplier: 3 });

    expect(first).toBe(300);
    expect(second).toBe(600);
  });
});

describe('selectContextItems', () => {
  it('under budget returns all items and no omitted ids', () => {
    const result = selectContextItems(['a', 'bb', 'ccc'], {
      estimate: (item) => item.length,
      maxBudget: 6,
      getId: (item) => item,
    });

    expect(result.selectedItems).toEqual(['a', 'bb', 'ccc']);
    expect(result.omittedIds).toEqual([]);
    expect(result.totalEstimate).toBe(6);
  });

  it('over budget omits ids deterministically while preserving selected input order', () => {
    const items = [
      { id: 'old-low', size: 2, priority: 0 },
      { id: 'new-low', size: 2, priority: 0 },
      { id: 'old-high', size: 2, priority: 2 },
      { id: 'new-high', size: 2, priority: 2 },
    ];

    const result = selectContextItems(items, {
      estimate: (item) => item.size,
      maxBudget: 4,
      getId: (item) => item.id,
      getPriority: (item) => item.priority,
    });

    expect(result.selectedItems.map((item) => item.id)).toEqual(['old-high', 'new-high']);
    expect(result.omittedIds).toEqual(['old-low', 'new-low']);
  });
});

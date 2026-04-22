import { describe, it, expect } from 'bun:test';

describe('useTabCompletion logic', () => {
  function createTabHandler(candidates: readonly string[]) {
    let completionIndex = -1;
    let lastPrefix = '';
    let matchedCandidates: readonly string[] = [];

    return {
      handleTab(currentInput: string): string | null {
        const prefix = currentInput.toLowerCase();
        if (prefix !== lastPrefix) {
          const matches = candidates.filter(c =>
            c.toLowerCase().startsWith(prefix)
          );
          if (matches.length === 0) return null;
          lastPrefix = prefix;
          matchedCandidates = matches;
          completionIndex = 0;
          return matches[0] ?? null;
        }
        if (matchedCandidates.length === 0) return null;
        const nextIndex = (completionIndex + 1) % matchedCandidates.length;
        completionIndex = nextIndex;
        return matchedCandidates[nextIndex] ?? null;
      },
      reset() {
        completionIndex = -1;
        lastPrefix = '';
        matchedCandidates = [];
      },
      get index() { return completionIndex; },
      get current() {
        return completionIndex >= 0 && completionIndex < matchedCandidates.length
          ? matchedCandidates[completionIndex] ?? null
          : null;
      },
    };
  }

  const candidates = ['/look', '/load', '/go', '/guard', '/help'];

  it('returns a completion matching the prefix on first tab', () => {
    const handler = createTabHandler(candidates);
    const result = handler.handleTab('/lo');
    expect(result).toBe('/look');
    expect(handler.index).toBe(0);
    expect(handler.current).toBe('/look');
  });

  it('cycles through matching candidates on repeated tab', () => {
    const handler = createTabHandler(candidates);
    expect(handler.handleTab('/lo')).toBe('/look');
    expect(handler.handleTab('/lo')).toBe('/load');
    expect(handler.handleTab('/lo')).toBe('/look');
  });

  it('returns null when no candidates match', () => {
    const handler = createTabHandler(candidates);
    expect(handler.handleTab('/xyz')).toBeNull();
  });

  it('resets on reset call', () => {
    const handler = createTabHandler(candidates);
    handler.handleTab('/lo');
    expect(handler.index).toBe(0);
    handler.reset();
    expect(handler.index).toBe(-1);
    expect(handler.current).toBeNull();
  });

  it('resets cycle when prefix changes', () => {
    const handler = createTabHandler(candidates);
    expect(handler.handleTab('/lo')).toBe('/look');
    expect(handler.handleTab('/g')).toBe('/go');
  });

  it('handles single candidate', () => {
    const handler = createTabHandler(candidates);
    expect(handler.handleTab('/h')).toBe('/help');
    expect(handler.handleTab('/h')).toBe('/help');
  });

  it('returns null for empty input (no prefix to match)', () => {
    const handler = createTabHandler(candidates);
    const result = handler.handleTab('');
    expect(result).toBeNull();
  });

  it('case-insensitive matching', () => {
    const handler = createTabHandler(candidates);
    expect(handler.handleTab('/LO')).toBe('/look');
  });
});

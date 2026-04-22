import { useState, useCallback, useRef } from 'react';

type UseTabCompletionReturn = {
  readonly completionIndex: number;
  readonly currentCompletion: string | null;
  readonly handleTab: (currentInput: string) => string | null;
  readonly resetCompletion: () => void;
};

export function useTabCompletion(candidates: readonly string[]): UseTabCompletionReturn {
  const [completionIndex, setCompletionIndex] = useState(-1);
  const [matchedCandidates, setMatchedCandidates] = useState<readonly string[]>([]);

  const completionRef = useRef({ index: -1, matches: [] as string[], prefix: '' });

  const handleTab = useCallback((currentInput: string): string | null => {
    const ref = completionRef.current;
    const prefix = currentInput.toLowerCase();

    if (prefix !== ref.prefix) {
      const matches = candidates.filter(c => c.toLowerCase().startsWith(prefix));
      if (matches.length === 0) return null;
      ref.prefix = prefix;
      ref.matches = matches;
      ref.index = 0;
      setCompletionIndex(0);
      setMatchedCandidates(matches);
      return matches[0] ?? null;
    }

    if (ref.matches.length === 0) return null;

    const nextIndex = (ref.index + 1) % ref.matches.length;
    ref.index = nextIndex;
    setCompletionIndex(nextIndex);
    return ref.matches[nextIndex] ?? null;
  }, [candidates]);

  const resetCompletion = useCallback(() => {
    completionRef.current = { index: -1, matches: [], prefix: '' };
    setCompletionIndex(-1);
    setMatchedCandidates([]);
  }, []);

  const currentCompletion = completionIndex >= 0 && completionIndex < matchedCandidates.length
    ? matchedCandidates[completionIndex] ?? null
    : null;

  return {
    completionIndex,
    currentCompletion,
    handleTab,
    resetCompletion,
  };
}

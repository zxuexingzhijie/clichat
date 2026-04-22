import { useState, useCallback } from 'react';

type UseTabCompletionReturn = {
  readonly completionIndex: number;
  readonly currentCompletion: string | null;
  readonly handleTab: (currentInput: string) => string | null;
  readonly resetCompletion: () => void;
};

export function useTabCompletion(candidates: readonly string[]): UseTabCompletionReturn {
  const [completionIndex, setCompletionIndex] = useState(-1);
  const [lastPrefix, setLastPrefix] = useState('');
  const [matchedCandidates, setMatchedCandidates] = useState<readonly string[]>([]);

  const handleTab = useCallback((currentInput: string): string | null => {
    const prefix = currentInput.toLowerCase();

    if (prefix !== lastPrefix) {
      const matches = candidates.filter(c =>
        c.toLowerCase().startsWith(prefix)
      );
      if (matches.length === 0) return null;

      setLastPrefix(prefix);
      setMatchedCandidates(matches);
      setCompletionIndex(0);
      return matches[0] ?? null;
    }

    if (matchedCandidates.length === 0) return null;

    const nextIndex = (completionIndex + 1) % matchedCandidates.length;
    setCompletionIndex(nextIndex);
    return matchedCandidates[nextIndex] ?? null;
  }, [candidates, completionIndex, lastPrefix, matchedCandidates]);

  const resetCompletion = useCallback(() => {
    setCompletionIndex(-1);
    setLastPrefix('');
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

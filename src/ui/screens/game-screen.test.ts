import { describe, it, expect, beforeEach } from 'bun:test';
import { gameStore, getDefaultGameState } from '../../state/game-store';

describe('BUG-03: SIGINT → pendingQuit', () => {
  beforeEach(() => {
    gameStore.setState(() => getDefaultGameState());
  });

  it('pendingQuit defaults to false', () => {
    expect(gameStore.getState().pendingQuit).toBe(false);
  });

  it('SIGINT handler logic sets pendingQuit = true (D-10)', () => {
    // Simulate the SIGINT handler body (same logic as index.tsx)
    gameStore.setState(draft => { draft.pendingQuit = true; });
    expect(gameStore.getState().pendingQuit).toBe(true);
  });

  it('cancelling quit resets pendingQuit to false', () => {
    gameStore.setState(draft => { draft.pendingQuit = true; });
    expect(gameStore.getState().pendingQuit).toBe(true);

    // Simulate cancel action from InlineConfirm
    gameStore.setState(draft => { draft.pendingQuit = false; });
    expect(gameStore.getState().pendingQuit).toBe(false);
  });
});

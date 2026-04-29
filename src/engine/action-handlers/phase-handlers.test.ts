import { describe, it, expect } from 'bun:test';
import { handleCompare } from './phase-handlers';
import { createGameStore } from '../../state/game-store';
import { eventBus } from '../../events/event-bus';

function makeCtx() {
  const gameStore = createGameStore(eventBus);
  return {
    stores: { game: gameStore } as any,
    eventBus,
  };
}

describe('handleCompare', () => {
  it('sets phase to compare', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare' } as any, ctx as any);
    expect(ctx.stores.game.getState().phase).toBe('compare');
  });

  it('parses two branch names into compareSpec', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare', target: 'main feature-branch' } as any, ctx as any);
    expect(ctx.stores.game.getState().compareSpec).toEqual({ source: 'main', target: 'feature-branch' });
  });

  it('sets compareSpec to null when no args given', async () => {
    const ctx = makeCtx();
    await handleCompare({ verb: 'compare' } as any, ctx as any);
    expect(ctx.stores.game.getState().compareSpec).toBeNull();
  });
});

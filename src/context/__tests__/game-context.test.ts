import { describe, it, expect } from 'bun:test';
import { createGameContext } from '../game-context';

describe('createGameContext', () => {
  it('creates a context with all 13 stores', () => {
    const ctx = createGameContext();
    expect(ctx.stores.player).toBeDefined();
    expect(ctx.stores.scene).toBeDefined();
    expect(ctx.stores.game).toBeDefined();
    expect(ctx.stores.combat).toBeDefined();
    expect(ctx.stores.dialogue).toBeDefined();
    expect(ctx.stores.quest).toBeDefined();
    expect(ctx.stores.relation).toBeDefined();
    expect(ctx.stores.exploration).toBeDefined();
    expect(ctx.stores.npcMemory).toBeDefined();
    expect(ctx.stores.playerKnowledge).toBeDefined();
    expect(ctx.stores.branch).toBeDefined();
    expect(ctx.stores.costSession).toBeDefined();
    expect(ctx.stores.turnLog).toBeDefined();
    expect(ctx.eventBus).toBeDefined();
  });

  it('creates isolated instances per call', () => {
    const ctx1 = createGameContext();
    const ctx2 = createGameContext();
    ctx1.stores.player.setState((d) => { d.hp = 1; });
    expect(ctx2.stores.player.getState().hp).toBe(30);
  });

  it('shares eventBus across stores within a context', () => {
    const ctx = createGameContext();
    const events: unknown[] = [];
    ctx.eventBus.on('player_damaged', (e) => events.push(e));
    ctx.stores.player.setState((d) => { d.hp = 20; });
    expect(events).toHaveLength(1);
  });
});

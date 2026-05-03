import { beforeEach, describe, it, expect } from 'bun:test';
import { appendTurnLog, resetTurnLog } from '../../engine/turn-log';
import { createSerializer } from '../../state/serializer';
import { createGameContext } from '../game-context';

beforeEach(() => {
  resetTurnLog();
});

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
    expect(ctx.stores.worldMemory).toBeDefined();
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

  it('does not bind global appendTurnLog to any GameContext turnLog store', () => {
    const ctx1 = createGameContext();
    const ctx2 = createGameContext();

    appendTurnLog({
      turnNumber: 1,
      action: 'look',
      checkResult: null,
      narrationLines: ['You look around.'],
    });

    expect(ctx1.stores.turnLog.getState().entries).toHaveLength(0);
    expect(ctx2.stores.turnLog.getState().entries).toHaveLength(0);
  });

  it('does not let a later GameContext inherit the global turn log', () => {
    const ctx1 = createGameContext();

    appendTurnLog({
      turnNumber: 1,
      action: 'look',
      checkResult: null,
      narrationLines: ['You look around.'],
    });
    const ctx2 = createGameContext();

    expect(ctx1.stores.turnLog.getState().entries).toHaveLength(0);
    expect(ctx2.stores.turnLog.getState().entries).toHaveLength(0);
  });

  it('keeps context turnLog stores and serializer snapshots isolated', () => {
    const ctx1 = createGameContext();
    const ctx2 = createGameContext();

    ctx1.stores.turnLog.setState((d) => {
      d.entries = [{
        turnNumber: 1,
        action: 'look',
        checkResult: null,
        narrationLines: ['You look around.'],
        timestamp: '2026-01-01T00:00:00.000Z',
      }];
    });

    expect(ctx1.stores.turnLog.getState().entries).toHaveLength(1);
    expect(ctx2.stores.turnLog.getState().entries).toHaveLength(0);

    const serializer1 = createSerializer({
      player: ctx1.stores.player,
      scene: ctx1.stores.scene,
      combat: ctx1.stores.combat,
      game: ctx1.stores.game,
      quest: ctx1.stores.quest,
      relations: ctx1.stores.relation,
      npcMemory: ctx1.stores.npcMemory,
      exploration: ctx1.stores.exploration,
      playerKnowledge: ctx1.stores.playerKnowledge,
      turnLog: ctx1.stores.turnLog,
      narrativeStore: ctx1.stores.narrative,
      worldMemory: ctx1.stores.worldMemory,
    }, () => 'main', () => null);
    const serializer2 = createSerializer({
      player: ctx2.stores.player,
      scene: ctx2.stores.scene,
      combat: ctx2.stores.combat,
      game: ctx2.stores.game,
      quest: ctx2.stores.quest,
      relations: ctx2.stores.relation,
      npcMemory: ctx2.stores.npcMemory,
      exploration: ctx2.stores.exploration,
      playerKnowledge: ctx2.stores.playerKnowledge,
      turnLog: ctx2.stores.turnLog,
      narrativeStore: ctx2.stores.narrative,
      worldMemory: ctx2.stores.worldMemory,
    }, () => 'main', () => null);

    expect(JSON.parse(serializer1.snapshot()).turnLog).toHaveLength(1);
    expect(JSON.parse(serializer2.snapshot()).turnLog).toHaveLength(0);
  });
});

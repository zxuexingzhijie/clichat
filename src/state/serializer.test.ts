import { describe, it, expect } from 'bun:test';
import { createStore } from './create-store';
import { getDefaultPlayerState, type PlayerState } from './player-store';
import { getDefaultSceneState, type SceneState } from './scene-store';
import { getDefaultCombatState, type CombatState } from './combat-store';
import { getDefaultGameState, type GameState } from './game-store';
import { createSerializer } from './serializer';

function freshStores() {
  return {
    player: createStore<PlayerState>(getDefaultPlayerState()),
    scene: createStore<SceneState>(getDefaultSceneState()),
    combat: createStore<CombatState>(getDefaultCombatState()),
    game: createStore<GameState>(getDefaultGameState()),
  };
}

describe('createSerializer', () => {
  it('snapshot returns JSON with required keys', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);
    const json = serializer.snapshot();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty('version', 1);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('player');
    expect(parsed).toHaveProperty('scene');
    expect(parsed).toHaveProperty('combat');
    expect(parsed).toHaveProperty('game');
  });

  it('snapshot reflects modified store state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);

    stores.player.setState(draft => { draft.hp = 20; });

    const parsed = JSON.parse(serializer.snapshot());
    expect(parsed.player.hp).toBe(20);
  });

  it('restore sets stores back to snapshot state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);
    const snap = serializer.snapshot();

    stores.player.setState(draft => { draft.hp = 1; });
    stores.game.setState(draft => { draft.day = 99; });

    serializer.restore(snap);

    expect(stores.player.getState().hp).toBe(30);
    expect(stores.game.getState().day).toBe(1);
  });

  it('roundtrip: snapshot -> modify -> restore preserves original state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);

    const originalHp = stores.player.getState().hp;
    const snap = serializer.snapshot();

    stores.player.setState(draft => { draft.hp = 5; });
    expect(stores.player.getState().hp).toBe(5);

    serializer.restore(snap);
    expect(stores.player.getState().hp).toBe(originalHp);
  });

  it('restore throws on invalid JSON', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);

    expect(() => serializer.restore('not json{')).toThrow('Invalid save data: malformed JSON');
  });

  it('restore throws on invalid player state (hp as string)', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);
    const snap = JSON.parse(serializer.snapshot());

    snap.player.hp = 'not-a-number';
    const bad = JSON.stringify(snap);

    expect(() => serializer.restore(bad)).toThrow('Invalid save data');
  });

  it('roundtrip: snapshot -> parse -> stringify -> restore produces identical state', () => {
    const stores = freshStores();
    const serializer = createSerializer(stores);

    stores.player.setState(draft => { draft.gold = 999; });
    stores.scene.setState(draft => { draft.sceneId = 'tavern_01'; });
    stores.combat.setState(draft => { draft.active = true; draft.roundNumber = 3; });
    stores.game.setState(draft => { draft.day = 7; draft.timeOfDay = 'dusk'; });

    const snap = serializer.snapshot();
    const repacked = JSON.stringify(JSON.parse(snap));

    const stores2 = freshStores();
    const serializer2 = createSerializer(stores2);
    serializer2.restore(repacked);

    expect(stores2.player.getState().gold).toBe(999);
    expect(stores2.scene.getState().sceneId).toBe('tavern_01');
    expect(stores2.combat.getState().active).toBe(true);
    expect(stores2.combat.getState().roundNumber).toBe(3);
    expect(stores2.game.getState().day).toBe(7);
    expect(stores2.game.getState().timeOfDay).toBe('dusk');
  });
});

import { describe, test, expect, beforeEach } from 'bun:test';
import { createCommandParser } from '../input/command-parser';
import { resolveNormalCheck } from '../engine/adjudication';
import { createSeededRng, rollD20 } from '../engine/dice';
import { createSerializer } from '../state/serializer';
import { playerStore, getDefaultPlayerState } from '../state/player-store';
import { sceneStore, getDefaultSceneState } from '../state/scene-store';
import { combatStore, getDefaultCombatState } from '../state/combat-store';
import { gameStore, getDefaultGameState } from '../state/game-store';
import { questStore } from '../state/quest-store';
import { relationStore } from '../state/relation-store';
import { npcMemoryStore } from '../state/npc-memory-store';
import { explorationStore } from '../state/exploration-store';
import { playerKnowledgeStore } from '../state/player-knowledge-store';
import { createStore } from '../state/create-store';
import { getDefaultTurnLogState, type TurnLogState } from '../state/turn-log-store';
import { createNarrativeStore } from '../state/narrative-state';
import { loadCodexFile } from '../codex/loader';
import { resolve } from 'node:path';
import { IntentSchema } from '../types/intent';

describe('Phase 1 Success Criteria', () => {
  beforeEach(() => {
    playerStore.setState(draft => { Object.assign(draft, getDefaultPlayerState()); });
    sceneStore.setState(draft => { Object.assign(draft, getDefaultSceneState()); });
    combatStore.setState(draft => { Object.assign(draft, getDefaultCombatState()); });
    gameStore.setState(draft => { Object.assign(draft, getDefaultGameState()); });
  });

  describe('CORE-01: Structured commands parse into game actions', () => {
    test('parser handles /look command', () => {
      const parser = createCommandParser();
      const result = parser.parse('/look');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('look');
      expect(result!.source).toBe('command');
    });

    test('parser handles /go north', () => {
      const parser = createCommandParser();
      const result = parser.parse('/go north');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('move');
      expect(result!.target).toBe('north');
    });

    test('parser handles /talk guard', () => {
      const parser = createCommandParser();
      const result = parser.parse('/talk guard');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('talk');
      expect(result!.target).toBe('guard');
    });

    test('parser handles /help without process.exit', () => {
      const parser = createCommandParser();
      const result = parser.parse('/help');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('help');
    });

    test('parser returns null for unknown command', () => {
      const parser = createCommandParser();
      const result = parser.parse('/xyz');
      expect(result).toBeNull();
    });
  });

  describe('CORE-02: NL intent classification validates via schema', () => {
    test('valid intent passes IntentSchema', () => {
      const validIntent = {
        action: 'move',
        target: 'north',
        modifiers: {},
        confidence: 0.9,
        raw_interpretation: 'move north',
      };
      const result = IntentSchema.safeParse(validIntent);
      expect(result.success).toBe(true);
    });

    test('invalid action rejects', () => {
      const invalid = { action: 'fly', target: null, confidence: 0.9, raw_interpretation: 'fly' };
      const result = IntentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('confidence out of range rejects', () => {
      const invalid = { action: 'move', target: null, confidence: 2.0, raw_interpretation: 'go' };
      const result = IntentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('CORE-03: Rules Engine resolves deterministically', () => {
    test('same seed produces identical results', () => {
      const rng1 = createSeededRng(42);
      const result1 = resolveNormalCheck({
        roll: rollD20(rng1),
        attributeName: 'physique',
        attributeModifier: 3,
        skillModifier: 0,
        environmentModifier: 0,
        dc: 12,
      });

      const rng2 = createSeededRng(42);
      const result2 = resolveNormalCheck({
        roll: rollD20(rng2),
        attributeName: 'physique',
        attributeModifier: 3,
        skillModifier: 0,
        environmentModifier: 0,
        dc: 12,
      });

      expect(result1.grade).toBe(result2.grade);
      expect(result1.total).toBe(result2.total);
      expect(result1.display).toBe(result2.display);
    });

    test('check result contains expected fields', () => {
      const result = resolveNormalCheck({
        roll: 15,
        attributeName: 'mind',
        attributeModifier: 1,
        skillModifier: 0,
        environmentModifier: 0,
        dc: 12,
      });

      expect(result.roll).toBe(15);
      expect(result.total).toBe(16);
      expect(result.dc).toBe(12);
      expect(result.grade).toBe('success');
      expect(result.display).toContain('D20: 15');
    });
  });

  describe('CORE-04: State serializes and restores identically', () => {
    test('snapshot -> modify -> restore -> state matches original', () => {
      const serializer = createSerializer({
        player: playerStore,
        scene: sceneStore,
        combat: combatStore,
        game: gameStore,
        quest: questStore,
        relations: relationStore,
        npcMemory: npcMemoryStore,
        exploration: explorationStore,
        playerKnowledge: playerKnowledgeStore,
        turnLog: createStore<TurnLogState>(getDefaultTurnLogState()),
        narrativeStore: createNarrativeStore(),
      }, () => 'main', () => null);

      const original = serializer.snapshot();
      const originalHp = playerStore.getState().hp;

      playerStore.setState(draft => { draft.hp = 15; });
      expect(playerStore.getState().hp).toBe(15);

      serializer.restore(original);
      expect(playerStore.getState().hp).toBe(originalHp);
    });

    test('snapshot roundtrip preserves all store data', () => {
      const serializer = createSerializer({
        player: playerStore,
        scene: sceneStore,
        combat: combatStore,
        game: gameStore,
        quest: questStore,
        relations: relationStore,
        npcMemory: npcMemoryStore,
        exploration: explorationStore,
        playerKnowledge: playerKnowledgeStore,
        turnLog: createStore<TurnLogState>(getDefaultTurnLogState()),
        narrativeStore: createNarrativeStore(),
      }, () => 'main', () => null);

      const snap1 = serializer.snapshot();
      const parsed = JSON.parse(snap1);

      expect(parsed.version).toBe(6);
      expect(parsed.player).toBeDefined();
      expect(parsed.scene).toBeDefined();
      expect(parsed.combat).toBeDefined();
      expect(parsed.game).toBeDefined();
    });

    test('invalid JSON is rejected', () => {
      const serializer = createSerializer({
        player: playerStore,
        scene: sceneStore,
        combat: combatStore,
        game: gameStore,
        quest: questStore,
        relations: relationStore,
        npcMemory: npcMemoryStore,
        exploration: explorationStore,
        playerKnowledge: playerKnowledgeStore,
        turnLog: createStore<TurnLogState>(getDefaultTurnLogState()),
        narrativeStore: createNarrativeStore(),
      }, () => 'main', () => null);

      expect(() => serializer.restore('not json at all')).toThrow('Invalid save data');
    });
  });

  describe('WORLD-01: YAML codex validates against Zod schemas', () => {
    test('locations codex loads and validates', async () => {
      const locations = await loadCodexFile(resolve(import.meta.dir, '../../world-data/codex/locations.yaml'));
      expect(locations.length).toBeGreaterThanOrEqual(1);
      expect(locations[0].type).toBe('location');
      expect(locations[0].id).toBeTruthy();
      expect(locations[0].epistemic).toBeTruthy();
    });
  });
});

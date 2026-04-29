import { describe, it, expect, mock } from 'bun:test';
import { createGameScreenController } from './game-screen-controller';
import { createStore } from '../state/create-store';
import mitt from 'mitt';
import type { GameState } from '../state/game-store';
import type { SceneState } from '../state/scene-store';
import type { DomainEvents } from '../events/event-types';
import type { GameLoop } from '../game-loop';
import type { DialogueManager, DialogueResult } from './dialogue-manager';
import type { CombatLoop } from './combat-loop';

function makeGameStore(overrides: Partial<GameState> = {}) {
  return createStore<GameState>({
    day: 1,
    timeOfDay: 'night',
    phase: 'game',
    turnCount: 0,
    isDarkTheme: true,
    pendingQuit: false,
    revealedNpcs: [],
    compareSpec: null,
    ...overrides,
  });
}

function makeSceneStore(overrides: Partial<SceneState> = {}) {
  return createStore<SceneState>({
    sceneId: 'test_scene',
    locationName: '测试地点',
    narrationLines: ['第一行'],
    actions: [
      { id: 'talk_guard', label: '向守卫说话', type: 'talk' },
      { id: 'inspect_door', label: '检查门', type: 'inspect' },
    ],
    npcsPresent: ['guard'],
    exits: ['north'],
    exitMap: { north: 'north' },
    objects: ['door'],
    ...overrides,
  });
}

describe('createGameScreenController', () => {
  describe('handlePanelClose', () => {
    it('sets game phase back to game', () => {
      const gameStore = makeGameStore({ phase: 'map' });
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      controller.handlePanelClose();

      expect(gameStore.getState().phase).toBe('game');
    });

    it('is a no-op if phase is already game', () => {
      const gameStore = makeGameStore({ phase: 'game' });
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      controller.handlePanelClose();

      expect(gameStore.getState().phase).toBe('game');
    });
  });

  describe('handlePhaseSwitch', () => {
    it('sets game phase to given target', () => {
      const gameStore = makeGameStore({ phase: 'game' });
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      controller.handlePhaseSwitch('map');
      expect(gameStore.getState().phase).toBe('map');

      controller.handlePhaseSwitch('journal');
      expect(gameStore.getState().phase).toBe('journal');

      controller.handlePhaseSwitch('chapter_summary');
      expect(gameStore.getState().phase).toBe('chapter_summary');
    });
  });

  describe('handleActionExecute', () => {
    it('does nothing if action index is out of bounds', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode },
      );

      await controller.handleActionExecute(99);

      expect(setInputMode).not.toHaveBeenCalled();
    });

    it('does nothing if gameLoop is not provided', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode },
      );

      await controller.handleActionExecute(0);

      expect(setInputMode).not.toHaveBeenCalled();
    });

    it('sets inputMode to processing then calls gameLoop.executeAction', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop: GameLoop = {
        executeAction: mock(async () => ({
          status: 'action_executed' as const,
          action: { type: 'talk' as const, target: 'guard', modifiers: {}, source: 'action_select' as const },
          narration: ['守卫转过头来。'],
        })),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
      } as unknown as GameLoop;

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      expect(setInputMode).toHaveBeenCalledWith('processing');
      expect(gameLoop.executeAction).toHaveBeenCalledWith({
        type: 'talk',
        target: 'guard',
        modifiers: {},
        source: 'action_select',
      });
      // handler returned narration — AI narration is skipped, input mode reset to action_select
      expect(startNarration).not.toHaveBeenCalled();
      expect(setInputMode).toHaveBeenCalledWith('action_select');
    });

    it('fires AI narration when handler returns no narration text', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop: GameLoop = {
        executeAction: mock(async () => ({
          status: 'action_executed' as const,
          action: { type: 'inspect' as const, target: 'notice_board', modifiers: {}, source: 'action_select' as const },
          narration: [],
        })),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
      } as unknown as GameLoop;

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      expect(startNarration).toHaveBeenCalled();
    });

    it('appends error line to narrationLines when gameLoop returns error status', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: ['初始行'] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop = {
        executeAction: mock(async () => ({
          status: 'error' as const,
          message: '无法执行',
        })),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
        loadLastSave: mock(async () => {}),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      const lines = sceneStore.getState().narrationLines;
      expect(lines).toContain('[错误] 无法执行');
      expect(setInputMode).toHaveBeenCalledWith('action_select');
      expect(startNarration).not.toHaveBeenCalled();
    });

    it('appends error line and resets to action_select when executeAction throws', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: [] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop = {
        executeAction: mock(async () => { throw new Error('网络错误'); }),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
        loadLastSave: mock(async () => {}),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      const lines = sceneStore.getState().narrationLines;
      expect(lines.some(l => l.includes('网络错误'))).toBe(true);
      expect(setInputMode).toHaveBeenCalledWith('action_select');
    });

    it('correctly parses target from action id with underscore', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({
        actions: [{ id: 'inspect_door', label: '检查门', type: 'inspect' }],
      });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop: GameLoop = {
        executeAction: mock(async () => ({
          status: 'action_executed' as const,
          action: { type: 'inspect' as const, target: 'door', modifiers: {}, source: 'action_select' as const },
          narration: [],
        })),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
      } as unknown as GameLoop;

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      expect(gameLoop.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'door' }),
      );
    });

    it('passes null target when action id has no underscore', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({
        actions: [{ id: 'look', label: '观察周围', type: 'look' }],
      });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const startNarration = mock(() => {});

      const gameLoop: GameLoop = {
        executeAction: mock(async () => ({
          status: 'action_executed' as const,
          action: { type: 'look' as const, target: null, modifiers: {}, source: 'action_select' as const },
          narration: [],
        })),
        processInput: mock(async () => ({ status: 'help' as const, commands: [] })),
        getCommandParser: mock(() => ({ parse: () => null })),
      } as unknown as GameLoop;

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, startNarration, gameLoop },
      );

      await controller.handleActionExecute(0);

      expect(gameLoop.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ target: null }),
      );
    });
  });

  describe('handleNarrationComplete', () => {
    it('appends streaming text to narrationLines and resets', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: ['第一行'] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const resetNarration = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, resetNarration },
      );

      controller.handleNarrationComplete('新的叙事文字');

      const lines = sceneStore.getState().narrationLines;
      expect(lines).toContain('新的叙事文字');
      expect(resetNarration).toHaveBeenCalled();
      expect(setInputMode).toHaveBeenCalledWith('action_select');
    });
  });

  describe('handleNarrationError', () => {
    it('appends error message to narrationLines and resets', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: [] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const resetNarration = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, resetNarration },
      );

      controller.handleNarrationError(new Error('模型超时'));

      const lines = sceneStore.getState().narrationLines;
      expect(lines.some(l => l.includes('叙事错误') && l.includes('模型超时'))).toBe(true);
      expect(resetNarration).toHaveBeenCalled();
      expect(setInputMode).toHaveBeenCalledWith('action_select');
    });
  });

  describe('handleNpcDialogueComplete', () => {
    it('appends NPC dialogue line to narrationLines and resets', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: [] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const resetNpcDialogue = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, resetNpcDialogue },
      );

      controller.handleNpcDialogueComplete('铁匠', '你好，旅行者。', 'processing');

      const lines = sceneStore.getState().narrationLines;
      expect(lines.some(l => l.includes('铁匠') && l.includes('你好，旅行者。'))).toBe(true);
      expect(resetNpcDialogue).toHaveBeenCalled();
      expect(setInputMode).toHaveBeenCalledWith('action_select');
    });

    it('does not call setInputMode if current mode is not processing', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore({ narrationLines: [] });
      const eventBus = mitt<DomainEvents>();
      const setInputMode = mock(() => {});
      const resetNpcDialogue = mock(() => {});

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { setInputMode, resetNpcDialogue },
      );

      controller.handleNpcDialogueComplete('铁匠', '你好。', 'action_select');

      expect(resetNpcDialogue).toHaveBeenCalled();
      expect(setInputMode).not.toHaveBeenCalled();
    });
  });

  describe('handleDialogueExecute', () => {
    it('calls dialogueManager.processPlayerResponse with the index', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const dialogueManager: DialogueManager = {
        processPlayerResponse: mock(async (_i: number) => null),
        processPlayerFreeText: mock(async (_t: string) => null),
        endDialogue: mock(() => {}),
        startDialogue: mock(async () => ({ mode: 'inline' as const, dialogue: '', npcName: '' } satisfies DialogueResult)),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { dialogueManager },
      );

      controller.handleDialogueExecute(2);

      expect(dialogueManager.processPlayerResponse).toHaveBeenCalledWith(2);
    });

    it('does nothing if dialogueManager is not provided', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      expect(() => controller.handleDialogueExecute(0)).not.toThrow();
    });
  });

  describe('handleDialogueEscape', () => {
    it('calls dialogueManager.endDialogue', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const dialogueManager: DialogueManager = {
        processPlayerResponse: mock(async (_i: number) => null),
        processPlayerFreeText: mock(async (_t: string) => null),
        endDialogue: mock(() => {}),
        startDialogue: mock(async () => ({ mode: 'inline' as const, dialogue: '', npcName: '' } satisfies DialogueResult)),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { dialogueManager },
      );

      controller.handleDialogueEscape();

      expect(dialogueManager.endDialogue).toHaveBeenCalled();
    });

    it('does nothing if dialogueManager is not provided', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      expect(() => controller.handleDialogueEscape()).not.toThrow();
    });
  });

  describe('handleCombatExecute', () => {
    it('calls combatLoop.processPlayerAction with the mapped action type', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '' })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'player_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      controller.handleCombatExecute(1);

      expect(combatLoop.processPlayerAction).toHaveBeenCalledWith('cast', { spellId: 'spell_fire_arrow' });
    });

    it('defaults to attack for out-of-bounds index', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '' })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'player_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      controller.handleCombatExecute(99);

      expect(combatLoop.processPlayerAction).toHaveBeenCalledWith('attack', undefined);
    });

    it('does nothing if combatLoop is not provided', () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        {},
      );

      expect(() => controller.handleCombatExecute(0)).not.toThrow();
    });

    it('does NOT call processEnemyTurn when outcome is flee', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '逃跑成功', outcome: 'flee' as const })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'enemy_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      await controller.handleCombatExecute(0);

      expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
    });

    it('does NOT call processEnemyTurn when outcome is victory', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '战斗胜利', outcome: 'victory' as const })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'enemy_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      await controller.handleCombatExecute(0);

      expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
    });

    it('does NOT call processEnemyTurn when outcome is defeat', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '战斗失败', outcome: 'defeat' as const })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'enemy_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      await controller.handleCombatExecute(0);

      expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
    });

    it('DOES call processEnemyTurn when no outcome and phase is enemy_turn', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '攻击' })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'enemy_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      await controller.handleCombatExecute(0);

      expect(combatLoop.processEnemyTurn).toHaveBeenCalledTimes(1);
    });

    it('does NOT call processEnemyTurn when phase is player_turn (no outcome)', async () => {
      const gameStore = makeGameStore();
      const sceneStore = makeSceneStore();
      const eventBus = mitt<DomainEvents>();

      const combatLoop: CombatLoop = {
        processPlayerAction: mock(async () => ({ status: 'ok' as const, narration: '攻击' })),
        startCombat: mock(async () => {}),
        processEnemyTurn: mock(async () => {}),
        checkCombatEnd: mock(async () => ({ ended: false as const })),
        getCombatPhase: mock(() => 'player_turn'),
      };

      const controller = createGameScreenController(
        { game: gameStore, scene: sceneStore },
        eventBus,
        { combatLoop },
      );

      await controller.handleCombatExecute(0);

      expect(combatLoop.processEnemyTurn).not.toHaveBeenCalled();
    });
  });
});

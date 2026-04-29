import { GAME_CONSTANTS } from './game-constants';
import { combatStore } from '../state/combat-store';
import type { Store } from '../state/create-store';
import type { GameState } from '../state/game-store';
import type { SceneState } from '../state/scene-store';
import type { DomainEvents } from '../events/event-types';
import type { GameLoop } from '../game-loop';
import type { DialogueManager } from './dialogue-manager';
import type { CombatLoop, CombatActionType } from './combat-loop';
import type { NarrativeContext } from '../ai/roles/narrative-director';
import type { Emitter } from 'mitt';

type ControllerStores = {
  readonly game: Store<GameState>;
  readonly scene: Store<SceneState>;
};

type InputMode = 'action_select' | 'input_active' | 'processing';

type ControllerDeps = {
  readonly gameLoop?: GameLoop;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly setInputMode?: (mode: InputMode) => void;
  readonly startNarration?: (context: NarrativeContext) => void;
  readonly resetNarration?: () => void;
  readonly resetNpcDialogue?: () => void;
};

export type GameScreenController = {
  readonly handlePanelClose: () => void;
  readonly handlePhaseSwitch: (phase: GameState['phase']) => void;
  readonly handleActionExecute: (index: number) => Promise<void>;
  readonly handleInputSubmit: (text: string) => void;
  readonly handleNarrationComplete: (text: string) => void;
  readonly handleNarrationError: (error: Error) => void;
  readonly handleNpcDialogueComplete: (npcName: string, dialogue: string, currentInputMode: InputMode) => void;
  readonly handleDialogueExecute: (index: number) => void;
  readonly handleDialogueEscape: () => void;
  readonly handleCombatExecute: (index: number) => Promise<void>;
};

const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee'];

function capNarrationLines(lines: readonly string[]): string[] {
  return lines.length > GAME_CONSTANTS.MAX_TURN_LOG_SIZE
    ? lines.slice(-GAME_CONSTANTS.MAX_TURN_LOG_SIZE) as string[]
    : [...lines];
}

export function createGameScreenController(
  stores: ControllerStores,
  eventBus: Emitter<DomainEvents>,
  deps: ControllerDeps,
): GameScreenController {
  const { game: gameStore, scene: sceneStore } = stores;
  const { gameLoop, dialogueManager, combatLoop, setInputMode, startNarration, resetNarration, resetNpcDialogue } = deps;

  const handlePanelClose = (): void => {
    gameStore.setState(draft => { draft.phase = 'game'; });
  };

  const handlePhaseSwitch = (phase: GameState['phase']): void => {
    gameStore.setState(draft => { draft.phase = phase; });
  };

  const handleActionExecute = async (index: number): Promise<void> => {
    const action = sceneStore.getState().actions[index];
    if (!action || !gameLoop) return;

    setInputMode?.('processing');
    try {
      const underscoreIdx = action.id.indexOf('_');
      const target = underscoreIdx >= 0 ? action.id.slice(underscoreIdx + 1) : null;
      const gameAction = {
        type: action.type as import('../types/game-action').GameActionType,
        target,
        modifiers: {},
        source: 'action_select' as const,
      };

      const result = await gameLoop.executeAction(gameAction);
      if (result.status === 'error') {
        sceneStore.setState(draft => {
          draft.narrationLines = capNarrationLines([...draft.narrationLines, `[错误] ${result.message ?? '未知错误'}`]);
        });
        setInputMode?.('action_select');
        return;
      }

      if (result.status === 'action_executed' && result.action.type === 'talk') {
        setInputMode?.('action_select');
        return;
      }

      const sceneState = sceneStore.getState();
      startNarration?.({
        sceneType: 'exploration',
        codexEntries: [],
        playerAction: action.label,
        recentNarration: sceneState.narrationLines.slice(-3),
        sceneContext: sceneState.locationName ?? '',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sceneStore.setState(draft => {
        draft.narrationLines = capNarrationLines([...draft.narrationLines, `[错误] ${msg}`]);
      });
      setInputMode?.('action_select');
    }
  };

  const handleInputSubmit = (text: string): void => {
    if (!text.trim() || !gameLoop) {
      setInputMode?.('action_select');
      return;
    }
    setInputMode?.('processing');
    gameLoop.processInput(text).then((result) => {
      if (result.status === 'error') {
        sceneStore.setState(draft => {
          draft.narrationLines = capNarrationLines([...draft.narrationLines, `[错误] ${result.message}`]);
        });
        setInputMode?.('action_select');
      } else if (result.status === 'clarification') {
        sceneStore.setState(draft => {
          draft.narrationLines = capNarrationLines([...draft.narrationLines, result.message]);
        });
        setInputMode?.('action_select');
      } else if (result.status === 'help') {
        sceneStore.setState(draft => {
          draft.narrationLines = capNarrationLines([...draft.narrationLines, ...result.commands]);
        });
        setInputMode?.('action_select');
      } else if (result.status === 'action_executed' && result.action.type === 'talk') {
        setInputMode?.('action_select');
      } else {
        const sceneState = sceneStore.getState();
        startNarration?.({
          sceneType: 'exploration',
          codexEntries: [],
          playerAction: text,
          recentNarration: sceneState.narrationLines.slice(-3),
          sceneContext: sceneState.locationName ?? '',
        });
      }
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      sceneStore.setState(draft => {
        draft.narrationLines = capNarrationLines([...draft.narrationLines, `[错误] ${msg}`]);
      });
      setInputMode?.('action_select');
    });
  };

  const handleNarrationComplete = (text: string): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = capNarrationLines([...draft.narrationLines, text]);
    });
    resetNarration?.();
    setInputMode?.('action_select');
  };

  const handleNarrationError = (error: Error): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = capNarrationLines([...draft.narrationLines, `[叙事错误] ${error.message}`]);
    });
    resetNarration?.();
    setInputMode?.('action_select');
  };

  const handleNpcDialogueComplete = (npcName: string, dialogue: string, currentInputMode: InputMode): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = capNarrationLines([
        ...draft.narrationLines,
        `${npcName}\uFF1A\u201C${dialogue}\u201D`,
      ]);
    });
    resetNpcDialogue?.();
    if (currentInputMode === 'processing') {
      setInputMode?.('action_select');
    }
  };

  const handleDialogueExecute = async (index: number): Promise<void> => {
    if (!dialogueManager) return;
    setInputMode?.('processing');
    try {
      await dialogueManager.processPlayerResponse(index);
    } catch (err: unknown) {
      console.error('[dialogue] processPlayerResponse failed:', err);
      eventBus.emit('ai_call_failed', { role: 'npc_actor', error: err instanceof Error ? err.message : String(err) });
      sceneStore.setState(draft => {
        draft.narrationLines = capNarrationLines([...draft.narrationLines, '[对话中断] 对话意外结束。']);
      });
      dialogueManager.endDialogue();
      gameStore.setState(draft => { draft.phase = 'game'; });
    } finally {
      setInputMode?.('action_select');
    }
  };

  const handleDialogueEscape = (): void => {
    if (!dialogueManager) return;
    dialogueManager.endDialogue();
  };

  const handleCombatExecute = async (index: number): Promise<void> => {
    if (!combatLoop) return;
    const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
    try {
      const opts = actionType === 'cast' ? { spellId: 'spell_fire_arrow' } : undefined;
      const result = await combatLoop.processPlayerAction(actionType, opts);
      if (result.status === 'error') {
        sceneStore.setState(draft => {
          draft.narrationLines = capNarrationLines([...draft.narrationLines, `[战斗] ${result.message}`]);
        });
        return;
      }
      if (
        combatLoop.getCombatPhase() === 'enemy_turn' &&
        result.outcome !== 'flee' &&
        result.outcome !== 'victory' &&
        result.outcome !== 'defeat'
      ) {
        await combatLoop.processEnemyTurn();
      }
    } catch (err: unknown) {
      console.error('[combat] processPlayerAction failed:', err);
      eventBus.emit('ai_call_failed', { role: 'narrative_director', error: err instanceof Error ? err.message : String(err) });
      combatStore.setState(draft => { draft.phase = 'player_turn'; });
    }
  };

  return {
    handlePanelClose,
    handlePhaseSwitch,
    handleActionExecute,
    handleInputSubmit,
    handleNarrationComplete,
    handleNarrationError,
    handleNpcDialogueComplete,
    handleDialogueExecute,
    handleDialogueEscape,
    handleCombatExecute,
  };
}

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
  readonly handleNarrationComplete: (text: string) => void;
  readonly handleNarrationError: (error: Error) => void;
  readonly handleNpcDialogueComplete: (npcName: string, dialogue: string, currentInputMode: InputMode) => void;
  readonly handleDialogueExecute: (index: number) => void;
  readonly handleDialogueEscape: () => void;
  readonly handleCombatExecute: (index: number) => void;
};

const COMBAT_ACTION_TYPES: readonly CombatActionType[] = ['attack', 'cast', 'guard', 'flee'];

export function createGameScreenController(
  stores: ControllerStores,
  _eventBus: Emitter<DomainEvents>,
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
          draft.narrationLines = [...draft.narrationLines, `[错误] ${result.message ?? '未知错误'}`];
        });
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
        draft.narrationLines = [...draft.narrationLines, `[错误] ${msg}`];
      });
      setInputMode?.('action_select');
    }
  };

  const handleNarrationComplete = (text: string): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = [...draft.narrationLines, text];
    });
    resetNarration?.();
    setInputMode?.('action_select');
  };

  const handleNarrationError = (error: Error): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = [...draft.narrationLines, `[叙事错误] ${error.message}`];
    });
    resetNarration?.();
    setInputMode?.('action_select');
  };

  const handleNpcDialogueComplete = (npcName: string, dialogue: string, currentInputMode: InputMode): void => {
    sceneStore.setState(draft => {
      draft.narrationLines = [
        ...draft.narrationLines,
        `${npcName}\uFF1A\u201C${dialogue}\u201D`,
      ];
    });
    resetNpcDialogue?.();
    if (currentInputMode === 'processing') {
      setInputMode?.('action_select');
    }
  };

  const handleDialogueExecute = (index: number): void => {
    if (!dialogueManager) return;
    dialogueManager.processPlayerResponse(index).catch(() => {});
  };

  const handleDialogueEscape = (): void => {
    if (!dialogueManager) return;
    dialogueManager.endDialogue();
  };

  const handleCombatExecute = (index: number): void => {
    if (!combatLoop) return;
    const actionType = COMBAT_ACTION_TYPES[index] ?? 'attack';
    combatLoop.processPlayerAction(actionType).catch(() => {});
  };

  return {
    handlePanelClose,
    handlePhaseSwitch,
    handleActionExecute,
    handleNarrationComplete,
    handleNarrationError,
    handleNpcDialogueComplete,
    handleDialogueExecute,
    handleDialogueEscape,
    handleCombatExecute,
  };
}

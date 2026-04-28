import type { GameAction } from '../../types/game-action';
import type { ProcessResult } from '../../game-loop';
import type { GameLoopStores } from '../../game-loop';
import type { EventBus } from '../../events/event-bus';
import type { SceneManager } from '../scene-manager';
import type { DialogueManager } from '../dialogue-manager';
import type { CombatLoop } from '../combat-loop';
import type { QuestSystem } from '../quest-system';
import type { Serializer } from '../../state/serializer';
import type { BranchMeta } from '../../state/branch-store';
import type { TurnLogEntry } from '../../state/serializer';
import type { CodexEntry } from '../../codex/schemas/entry-types';

export type ActionContext = {
  readonly stores: GameLoopStores;
  readonly eventBus: EventBus;
  readonly sceneManager?: SceneManager;
  readonly dialogueManager?: DialogueManager;
  readonly combatLoop?: CombatLoop;
  readonly questSystem?: QuestSystem;
  readonly saveFileManager?: {
    readonly quickSave: (serializer: Serializer, saveDir: string) => Promise<string>;
    readonly saveGame: (name: string, serializer: Serializer, saveDir: string) => Promise<string>;
    readonly loadGame: (filePath: string, serializer: Serializer, saveDir?: string) => Promise<void>;
  };
  readonly serializer?: Serializer;
  readonly saveDir?: string;
  readonly branchManager?: {
    readonly createBranch: (name: string) => BranchMeta;
    readonly switchBranch: (branchId: string) => void;
    readonly deleteBranch: (branchId: string) => void;
    readonly getBranchMeta: (branchId: string) => BranchMeta | undefined;
  };
  readonly turnLog?: {
    readonly replayTurns: (count: number) => readonly TurnLogEntry[];
  };
  readonly rng?: () => number;
  readonly codexEntries?: Map<string, CodexEntry>;
};

export type ActionHandler = (
  action: GameAction,
  ctx: ActionContext,
) => Promise<ProcessResult>;

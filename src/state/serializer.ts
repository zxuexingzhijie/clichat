import { z } from 'zod';
import type { Store } from './create-store';
import { PlayerStateSchema, type PlayerState } from './player-store';
import { SceneStateSchema, type SceneState } from './scene-store';
import { CombatStateSchema, type CombatState } from './combat-store';
import { GameStateSchema, type GameState } from './game-store';
import { QuestStateSchema, QuestEventSchema, type QuestState, type QuestEvent, type QuestStore } from './quest-store';
import { RelationStateSchema, type RelationState, type RelationStore } from './relation-store';
import { NpcMemoryStateSchema, type NpcMemoryState } from './npc-memory-store';
import { ExplorationStateSchema, type ExplorationState } from './exploration-store';
import { PlayerKnowledgeStateSchema, type PlayerKnowledgeState } from './player-knowledge-store';
import type { TurnLogState } from './turn-log-store';
import { migrateV1ToV2, migrateV2ToV3, migrateV3ToV4 } from '../persistence/save-migrator';
import { restoreQuestEventLog } from './quest-store';
import { restoreTurnLog } from '../engine/turn-log';

export interface Serializer {
  snapshot(saveName?: string): string;
  restore(json: string): void;
}

export const SaveMetaSchema = z.object({
  saveName: z.string(),
  timestamp: z.string(),
  character: z.object({
    name: z.string(),
    race: z.string(),
    profession: z.string(),
  }),
  playtime: z.number(),
  locationName: z.string(),
});
export type SaveMeta = z.infer<typeof SaveMetaSchema>;

export const SaveDataV2Schema = z.object({
  version: z.literal(2),
  meta: SaveMetaSchema,
  player: PlayerStateSchema,
  scene: SceneStateSchema,
  combat: CombatStateSchema,
  game: GameStateSchema,
  quest: QuestStateSchema,
  relations: RelationStateSchema,
  npcMemorySnapshot: NpcMemoryStateSchema,
  questEventLog: z.array(QuestEventSchema),
  externalRefs: z.object({
    worldPack: z.string(),
    rulesPack: z.string(),
  }).optional(),
});
export type SaveDataV2 = z.infer<typeof SaveDataV2Schema>;

export const TurnLogEntrySchema = z.object({
  turnNumber: z.number(),
  action: z.string(),
  checkResult: z.string().nullable(),
  narrationLines: z.array(z.string()),
  npcDialogue: z.array(z.string()).optional(),
  timestamp: z.string(),
});
export type TurnLogEntry = z.infer<typeof TurnLogEntrySchema>;

export const SaveDataV3Schema = z.object({
  version: z.literal(3),
  meta: SaveMetaSchema,
  branchId: z.string(),
  parentSaveId: z.string().nullable(),
  player: PlayerStateSchema,
  scene: SceneStateSchema,
  combat: CombatStateSchema,
  game: GameStateSchema,
  quest: QuestStateSchema,
  relations: RelationStateSchema,
  npcMemorySnapshot: NpcMemoryStateSchema,
  questEventLog: z.array(QuestEventSchema),
  exploration: ExplorationStateSchema,
  playerKnowledge: PlayerKnowledgeStateSchema,
  turnLog: z.array(TurnLogEntrySchema),
  externalRefs: z.object({
    worldPack: z.string(),
    rulesPack: z.string(),
  }).optional(),
});
export type SaveDataV3 = z.infer<typeof SaveDataV3Schema>;

export const SaveDataV4Schema = SaveDataV3Schema.extend({
  version: z.literal(4),
});
export type SaveDataV4 = z.infer<typeof SaveDataV4Schema>;

export function createSerializer(
  stores: {
    player: Store<PlayerState>;
    scene: Store<SceneState>;
    combat: Store<CombatState>;
    game: Store<GameState>;
    quest: QuestStore;
    relations: RelationStore;
    npcMemory: Store<NpcMemoryState>;
    exploration: Store<ExplorationState>;
    playerKnowledge: Store<PlayerKnowledgeState>;
    turnLog: Store<TurnLogState>;
  },
  getBranchId: () => string,
  getParentSaveId: () => string | null,
  getPlaytime: () => number = () => 0,
): Serializer {
  return {
    snapshot(saveName?: string): string {
      const player = stores.player.getState();
      const scene = stores.scene.getState();
      const game = stores.game.getState();

      const meta: SaveMeta = {
        saveName: saveName ?? 'Quick Save',
        timestamp: new Date().toISOString(),
        character: {
          name: player.name,
          race: player.race,
          profession: player.profession,
        },
        playtime: getPlaytime(),
        locationName: scene.sceneId,
      };

      const data: SaveDataV4 = {
        version: 4,
        meta,
        branchId: getBranchId(),
        parentSaveId: getParentSaveId(),
        player,
        scene,
        combat: stores.combat.getState(),
        game,
        quest: stores.quest.getState(),
        relations: stores.relations.getState(),
        npcMemorySnapshot: stores.npcMemory.getState(),
        questEventLog: stores.quest.getState().eventLog,
        exploration: stores.exploration.getState(),
        playerKnowledge: stores.playerKnowledge.getState(),
        turnLog: stores.turnLog.getState().entries,
      };
      return JSON.stringify(data);
    },

    restore(json: string): void {
      let raw: unknown;
      try {
        raw = JSON.parse(json);
      } catch {
        throw new Error('Invalid save data: malformed JSON');
      }

      const migrated = migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(raw)));

      const v4Result = SaveDataV4Schema.safeParse(migrated);
      const v3Fallback = v4Result.success ? null : SaveDataV3Schema.safeParse(migrated);
      const result = v4Result.success ? v4Result : v3Fallback;

      if (!result || !result.success) {
        const firstIssue = v4Result.error?.issues?.[0];
        const detail = firstIssue
          ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
          : v4Result.error?.message ?? 'unknown error';
        throw new Error(`Invalid save data: ${detail}`);
      }

      const data = result.data;
      stores.player.setState(draft => { Object.assign(draft, data.player); });
      stores.scene.setState(draft => { Object.assign(draft, data.scene); });
      stores.combat.setState(draft => { Object.assign(draft, data.combat); });
      stores.game.setState(draft => { Object.assign(draft, data.game); });
      stores.quest.restoreState(data.quest);
      stores.relations.restoreState(data.relations);
      stores.npcMemory.setState(draft => { Object.assign(draft, data.npcMemorySnapshot); });
      stores.exploration.setState(draft => { Object.assign(draft, data.exploration); });
      stores.playerKnowledge.setState(draft => { Object.assign(draft, data.playerKnowledge); });

      stores.turnLog.setState(draft => { draft.entries = data.turnLog; });
      restoreQuestEventLog((data.questEventLog ?? []) as QuestEvent[]);
      restoreTurnLog(data.turnLog ?? []);
    },
  };
}

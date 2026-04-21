import { z } from 'zod';
import type { Store } from './create-store';
import { PlayerStateSchema, type PlayerState } from './player-store';
import { SceneStateSchema, type SceneState } from './scene-store';
import { CombatStateSchema, type CombatState } from './combat-store';
import { GameStateSchema, type GameState } from './game-store';
import { QuestStateSchema, QuestEventSchema, resetQuestEventLog, restoreQuestEventLog, type QuestState, type QuestEvent } from './quest-store';
import { RelationStateSchema, type RelationState } from './relation-store';
import { NpcMemoryStateSchema, type NpcMemoryState } from './npc-memory-store';
import { migrateV1ToV2 } from '../persistence/save-migrator';

export interface Serializer {
  snapshot(): string;
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

export function createSerializer(
  stores: {
    player: Store<PlayerState>;
    scene: Store<SceneState>;
    combat: Store<CombatState>;
    game: Store<GameState>;
    quest: Store<QuestState>;
    relations: Store<RelationState>;
    npcMemory: Store<NpcMemoryState>;
  },
  getQuestEventLog: () => QuestEvent[],
): Serializer {
  return {
    snapshot(): string {
      const player = stores.player.getState();
      const scene = stores.scene.getState();
      const game = stores.game.getState();

      const meta: SaveMeta = {
        saveName: 'Quick Save',
        timestamp: new Date().toISOString(),
        character: {
          name: player.name,
          race: player.race,
          profession: player.profession,
        },
        playtime: 0,
        locationName: scene.sceneId,
      };

      const data: SaveDataV2 = {
        version: 2,
        meta,
        player,
        scene,
        combat: stores.combat.getState(),
        game,
        quest: stores.quest.getState(),
        relations: stores.relations.getState(),
        npcMemorySnapshot: stores.npcMemory.getState(),
        questEventLog: getQuestEventLog(),
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

      const migrated = migrateV1ToV2(raw);

      const result = SaveDataV2Schema.safeParse(migrated);
      if (!result.success) {
        const firstIssue = result.error.issues?.[0];
        const detail = firstIssue
          ? `${firstIssue.path.join('.')} — ${firstIssue.message}`
          : result.error.message;
        throw new Error(`Invalid save data: ${detail}`);
      }

      const data = result.data;
      stores.player.setState(draft => { Object.assign(draft, data.player); });
      stores.scene.setState(draft => { Object.assign(draft, data.scene); });
      stores.combat.setState(draft => { Object.assign(draft, data.combat); });
      stores.game.setState(draft => { Object.assign(draft, data.game); });
      stores.quest.setState(draft => { Object.assign(draft, data.quest); });
      stores.relations.setState(draft => { Object.assign(draft, data.relations); });
      stores.npcMemory.setState(draft => { Object.assign(draft, data.npcMemorySnapshot); });

      resetQuestEventLog();
      restoreQuestEventLog(data.questEventLog);
    },
  };
}

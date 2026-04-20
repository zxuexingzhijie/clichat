import { z } from 'zod';
import type { Store } from './create-store';
import { PlayerStateSchema, type PlayerState } from './player-store';
import { SceneStateSchema, type SceneState } from './scene-store';
import { CombatStateSchema, type CombatState } from './combat-store';
import { GameStateSchema, type GameState } from './game-store';

export interface Serializer {
  snapshot(): string;
  restore(json: string): void;
}

export const SaveDataSchema = z.object({
  version: z.literal(1),
  timestamp: z.string(),
  player: PlayerStateSchema,
  scene: SceneStateSchema,
  combat: CombatStateSchema,
  game: GameStateSchema,
});

export type SaveData = z.infer<typeof SaveDataSchema>;

export function createSerializer(stores: {
  player: Store<PlayerState>;
  scene: Store<SceneState>;
  combat: Store<CombatState>;
  game: Store<GameState>;
}): Serializer {
  return {
    snapshot(): string {
      const data: SaveData = {
        version: 1,
        timestamp: new Date().toISOString(),
        player: stores.player.getState(),
        scene: stores.scene.getState(),
        combat: stores.combat.getState(),
        game: stores.game.getState(),
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

      const result = SaveDataSchema.safeParse(raw);
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
    },
  };
}

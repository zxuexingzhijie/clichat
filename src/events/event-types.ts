import type { CheckResult, DamageResult } from '../types/common';
import type { GameAction } from '../types/game-action';

export type DomainEvents = {
  action_resolved: { action: GameAction; result: CheckResult };
  damage_dealt: { result: DamageResult; targetId: string };

  scene_changed: { sceneId: string; previousSceneId: string | null };
  narration_updated: { lines: string[] };

  combat_started: { enemies: string[] };
  combat_ended: { outcome: 'victory' | 'defeat' | 'flee' };

  player_damaged: { amount: number; source: string };
  player_healed: { amount: number; source: string };
  gold_changed: { delta: number; newTotal: number };

  time_advanced: { day: number; timeOfDay: string };
  game_phase_changed: { phase: string };

  state_snapshot_requested: undefined;
  state_restored: undefined;
};

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

  dialogue_started: { npcId: string; npcName: string; mode: 'inline' | 'full' };
  dialogue_ended: { npcId: string };
  dialogue_response_selected: { npcId: string; responseIndex: number };

  npc_memory_written: { npcId: string; event: string; turnNumber: number };

  character_creation_started: undefined;
  character_creation_step_changed: { step: number; totalSteps: number };
  character_created: { name: string; race: string; profession: string };

  combat_action_resolved: { actorId: string; action: string; checkResult: CheckResult };
  combat_turn_advanced: { currentActorId: string; roundNumber: number };

  narration_streaming_started: { sceneType: string };
  narration_streaming_completed: { charCount: number };

  ai_call_failed: { role: string; error: string };
};

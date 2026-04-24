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

  npc_dialogue_streaming_started: { npcId: string; npcName: string };
  npc_dialogue_streaming_completed: { npcId: string; charCount: number };

  ai_call_failed: { role: string; error: string };

  quest_started: { questId: string; questTitle: string; turnNumber: number };
  quest_stage_advanced: { questId: string; newStageId: string; turnNumber: number };
  quest_objective_completed: { questId: string; objectiveId: string };
  quest_completed: { questId: string; rewards: unknown };
  quest_failed: { questId: string; reason: string };
  reputation_changed: { targetId: string; targetType: 'npc' | 'faction'; delta: number; newValue: number };
  save_game_requested: { saveName: string | null };
  save_game_completed: { filePath: string };
  load_game_requested: { saveName: string | null };
  load_game_completed: undefined;

  branch_created: { branchId: string; branchName: string; parentBranchId: string | null };
  branch_switched: { fromBranchId: string; toBranchId: string };
  branch_deleted: { branchId: string; branchName: string };
  knowledge_discovered: { entryId: string; codexEntryId: string | null; knowledgeStatus: string; turnNumber: number };
  location_explored: { locationId: string; newLevel: string; previousLevel: string | null };
  location_discovery_level_changed: { locationId: string; oldLevel: string; newLevel: string };
  token_usage_updated: { lastTurnTokens: number };
  summarizer_task_completed: { taskId: string; type: string };
};

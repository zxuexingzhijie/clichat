import { describe, it, expect } from 'bun:test';
import { GAME_CONSTANTS } from './game-constants';

describe('GAME_CONSTANTS', () => {
  it('exports combat constants', () => {
    expect(GAME_CONSTANTS.DEFAULT_DC).toBe(12);
    expect(GAME_CONSTANTS.BASE_AC).toBe(10);
    expect(GAME_CONSTANTS.CAST_MP_COST).toBe(4);
    expect(GAME_CONSTANTS.FLEE_DC).toBe(10);
    expect(GAME_CONSTANTS.GUARD_AC_BONUS).toBe(2);
    expect(GAME_CONSTANTS.DEFAULT_WEAPON_BASE).toBe(5);
    expect(GAME_CONSTANTS.CAST_WEAPON_BASE).toBe(6);
  });

  it('exports narration constants', () => {
    expect(GAME_CONSTANTS.NARRATION_MAX_LENGTH).toBe(300);
    expect(GAME_CONSTANTS.NARRATION_MIN_LENGTH).toBe(10);
  });

  it('exports AI/system constants', () => {
    expect(GAME_CONSTANTS.NPC_MEMORY_MAX_RECENT).toBe(3);
    expect(GAME_CONSTANTS.CONFIDENCE_THRESHOLD).toBe(0.3);
    expect(GAME_CONSTANTS.MAX_TURN_LOG_SIZE).toBe(50);
  });
});

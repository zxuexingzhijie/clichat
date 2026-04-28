import { describe, it, expect } from 'bun:test';
import { LocationSchema } from './entry-types';

const validEpistemic = {
  authority: 'canonical_truth' as const,
  truth_status: 'true' as const,
  scope: 'regional' as const,
  visibility: 'public' as const,
  confidence: 1.0,
  source_type: 'authorial' as const,
  known_by: [],
  contradicts: [],
  volatility: 'stable' as const,
};

const validLocation = {
  id: 'loc_dark_cave',
  name: '黑暗洞穴',
  type: 'location' as const,
  tags: ['dungeon'],
  description: '一个危险的洞穴',
  epistemic: validEpistemic,
  region: '荒野',
  danger_level: 7,
  exits: ['loc_forest'],
  notable_npcs: [],
  objects: [],
};

describe('LocationSchema enemies field', () => {
  it('accepts enemies array with one entry', () => {
    const result = LocationSchema.parse({ ...validLocation, enemies: ['enemy_wolf'] });
    expect(result.enemies).toEqual(['enemy_wolf']);
  });

  it('parses location without enemies field (optional)', () => {
    const result = LocationSchema.parse(validLocation);
    expect(result.enemies).toBeUndefined();
  });

  it('infers enemies as optional string array on Location type', () => {
    const result = LocationSchema.parse({ ...validLocation, enemies: ['enemy_wolf', 'enemy_wolf_alpha'] });
    const enemies: string[] | undefined = result.enemies;
    expect(enemies).toHaveLength(2);
  });
});

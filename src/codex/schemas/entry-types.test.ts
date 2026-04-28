import { describe, it, expect } from 'bun:test';
import { LocationSchema, SpellSchema } from './entry-types';

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

const validSpell = {
  id: 'spell_test',
  name: '测试法术',
  type: 'spell' as const,
  tags: ['fire', 'attack'],
  description: '测试法术描述',
  epistemic: validEpistemic,
  element: 'fire',
  mp_cost: 3,
  effect: '造成伤害',
  requirements: [],
};

describe('SpellSchema effect_type and base_value', () => {
  it('parses spell with effect_type and base_value', () => {
    const result = SpellSchema.parse({ ...validSpell, effect_type: 'damage', base_value: 4 });
    expect(result.effect_type).toBe('damage');
    expect(result.base_value).toBe(4);
  });

  it('parses spell without effect_type or base_value (fields are optional)', () => {
    const result = SpellSchema.parse(validSpell);
    expect(result.effect_type).toBeUndefined();
    expect(result.base_value).toBeUndefined();
  });

  it('accepts all effect_type enum values', () => {
    expect(SpellSchema.parse({ ...validSpell, effect_type: 'heal' }).effect_type).toBe('heal');
    expect(SpellSchema.parse({ ...validSpell, effect_type: 'buff' }).effect_type).toBe('buff');
  });
});

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

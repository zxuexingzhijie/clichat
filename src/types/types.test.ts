import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

import {
  EntityIdSchema,
  PositionSchema,
  AttributeNameSchema,
  SuccessGradeSchema,
  CheckResultSchema,
  DamageResultSchema,
  TimeOfDaySchema,
  AdjudicationModeSchema,
  ATTRIBUTE_LABELS,
  GRADE_LABELS,
  TIME_OF_DAY_LABELS,
} from './common';

import {
  GameActionSchema,
  GameActionTypeSchema,
} from './game-action';

import {
  IntentSchema,
  IntentActionSchema,
} from './intent';

describe('common types', () => {
  it('validates EntityId as non-empty string', () => {
    expect(EntityIdSchema.parse('abc')).toBe('abc');
    expect(() => EntityIdSchema.parse('')).toThrow();
  });

  it('validates Position with x,y numbers', () => {
    const pos = PositionSchema.parse({ x: 1, y: 2 });
    expect(pos).toEqual({ x: 1, y: 2 });
  });

  it('validates AttributeName enum', () => {
    expect(AttributeNameSchema.parse('physique')).toBe('physique');
    expect(AttributeNameSchema.parse('finesse')).toBe('finesse');
    expect(AttributeNameSchema.parse('mind')).toBe('mind');
    expect(() => AttributeNameSchema.parse('strength')).toThrow();
  });

  it('has Chinese labels for all attributes', () => {
    expect(ATTRIBUTE_LABELS.physique).toBe('体魄');
    expect(ATTRIBUTE_LABELS.finesse).toBe('技巧');
    expect(ATTRIBUTE_LABELS.mind).toBe('心智');
  });

  it('validates SuccessGrade includes all 6 grades', () => {
    const grades = [
      'critical_success',
      'great_success',
      'success',
      'partial_success',
      'failure',
      'critical_failure',
    ] as const;
    for (const grade of grades) {
      expect(SuccessGradeSchema.parse(grade)).toBe(grade);
    }
    expect(() => SuccessGradeSchema.parse('mediocre')).toThrow();
  });

  it('has Chinese labels for all grades', () => {
    expect(GRADE_LABELS.critical_success).toBe('大成功！');
    expect(GRADE_LABELS.failure).toBe('失败');
  });

  it('validates CheckResult with complete check data', () => {
    const result = CheckResultSchema.parse({
      roll: 14,
      attributeName: 'physique',
      attributeModifier: 3,
      skillModifier: 1,
      environmentModifier: 0,
      total: 18,
      dc: 15,
      grade: 'success',
      display: '[D20: 14] + 体魄 3 + 技能 1 = 18 vs DC 15 → 成功！',
    });
    expect(result.roll).toBe(14);
    expect(result.grade).toBe('success');
    expect(result.total).toBe(18);
  });

  it('rejects invalid CheckResult roll outside 1-20', () => {
    expect(() => CheckResultSchema.parse({
      roll: 0,
      attributeName: 'physique',
      attributeModifier: 3,
      skillModifier: 0,
      environmentModifier: 0,
      total: 3,
      dc: 10,
      grade: 'failure',
      display: 'test',
    })).toThrow();
  });

  it('validates DamageResult', () => {
    const dmg = DamageResultSchema.parse({
      weaponBase: 8,
      attributeModifier: 3,
      gradeBonus: 2,
      armorReduction: 4,
      total: 9,
      display: '8 + 3 + 2 - 4 = 9',
    });
    expect(dmg.total).toBe(9);
  });

  it('validates TimeOfDay enum', () => {
    expect(TimeOfDaySchema.parse('dawn')).toBe('dawn');
    expect(TimeOfDaySchema.parse('night')).toBe('night');
    expect(() => TimeOfDaySchema.parse('afternoon')).toThrow();
  });

  it('has Chinese labels for time of day', () => {
    expect(TIME_OF_DAY_LABELS.dawn).toBe('黎明');
    expect(TIME_OF_DAY_LABELS.night).toBe('夜晚');
  });

  it('validates AdjudicationMode enum', () => {
    expect(AdjudicationModeSchema.parse('normal')).toBe('normal');
    expect(AdjudicationModeSchema.parse('opposed')).toBe('opposed');
    expect(AdjudicationModeSchema.parse('probability')).toBe('probability');
    expect(AdjudicationModeSchema.parse('plot_critical')).toBe('plot_critical');
    expect(() => AdjudicationModeSchema.parse('random')).toThrow();
  });
});

describe('GameAction', () => {
  it('parses valid action with defaults', () => {
    const action = GameActionSchema.parse({
      type: 'look',
      target: null,
      modifiers: {},
    });
    expect(action.type).toBe('look');
    expect(action.target).toBeNull();
    expect(action.source).toBe('command');
  });

  it('rejects invalid action type', () => {
    expect(() => GameActionSchema.parse({ type: 'invalid_type' })).toThrow();
  });

  it('parses action with explicit source', () => {
    const action = GameActionSchema.parse({
      type: 'attack',
      target: 'goblin',
      modifiers: { weapon: 'sword' },
      source: 'intent',
    });
    expect(action.source).toBe('intent');
    expect(action.target).toBe('goblin');
  });

  it('validates all game action types', () => {
    const types = [
      'move', 'look', 'talk', 'attack', 'use_item',
      'cast', 'guard', 'flee', 'inspect', 'trade',
      'help', 'save', 'unknown',
    ] as const;
    for (const t of types) {
      expect(GameActionTypeSchema.parse(t)).toBe(t);
    }
  });
});

describe('Intent', () => {
  it('parses valid intent', () => {
    const intent = IntentSchema.parse({
      action: 'move',
      target: 'north',
      modifiers: {},
      confidence: 0.9,
      raw_interpretation: 'go north',
    });
    expect(intent.action).toBe('move');
    expect(intent.target).toBe('north');
    expect(intent.confidence).toBe(0.9);
  });

  it('rejects confidence above 1.0', () => {
    expect(() => IntentSchema.parse({
      action: 'move',
      target: null,
      confidence: 1.5,
      raw_interpretation: 'go somewhere',
    })).toThrow();
  });

  it('rejects confidence below 0', () => {
    expect(() => IntentSchema.parse({
      action: 'look',
      target: null,
      confidence: -0.1,
      raw_interpretation: 'look around',
    })).toThrow();
  });

  it('validates all intent action types', () => {
    const actions = [
      'move', 'look', 'talk', 'attack', 'use_item',
      'cast', 'guard', 'flee', 'inspect', 'trade',
    ] as const;
    for (const a of actions) {
      expect(IntentActionSchema.parse(a)).toBe(a);
    }
  });

  it('allows optional modifiers', () => {
    const intent = IntentSchema.parse({
      action: 'talk',
      target: 'merchant',
      confidence: 0.8,
      raw_interpretation: 'talk to the merchant',
    });
    expect(intent.modifiers).toBeUndefined();
  });
});

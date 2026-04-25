import { describe, it, expect, beforeAll } from 'bun:test';
import { resolve } from 'node:path';
import { loadAllCodex } from '../codex/loader';
import { createCharacterCreation } from './character-creation';
import type { CodexEntry } from '../codex/schemas/entry-types';

let codexEntries: Map<string, CodexEntry>;
let cc: ReturnType<typeof createCharacterCreation>;

beforeAll(async () => {
  codexEntries = await loadAllCodex(resolve(import.meta.dir, '../../world-data/codex'));
  cc = createCharacterCreation(codexEntries);
});

describe('getAvailableRaces', () => {
  it('returns only races with playable tag', () => {
    const races = cc.getAvailableRaces();
    expect(races.length).toBeGreaterThanOrEqual(3);
    for (const race of races) {
      expect(race.type).toBe('race');
      expect(race.tags).toContain('playable');
    }
  });
});

describe('getAvailableProfessions', () => {
  it('returns all professions', () => {
    const professions = cc.getAvailableProfessions();
    expect(professions.length).toBeGreaterThanOrEqual(3);
    for (const prof of professions) {
      expect(prof.type).toBe('profession');
    }
  });
});

describe('getBackgroundHooks', () => {
  it('returns backgrounds matching the origin question', () => {
    const origins = cc.getBackgroundHooks('你为什么来到黑松镇？');
    expect(origins.length).toBeGreaterThanOrEqual(3);
    for (const bg of origins) {
      expect(bg.question).toBe('你为什么来到黑松镇？');
    }
  });

  it('returns backgrounds matching the secret question', () => {
    const secrets = cc.getBackgroundHooks('你身上有什么秘密？');
    expect(secrets.length).toBeGreaterThanOrEqual(3);
    for (const bg of secrets) {
      expect(bg.question).toBe('你身上有什么秘密？');
    }
  });
});

describe('calculateAttributes', () => {
  it('applies base + profession primary + background biases', () => {
    const attrs = cc.calculateAttributes('race_human', 'prof_adventurer', ['bg_refugee', 'bg_secret_debt']);
    expect(attrs.physique).toBe(2 + 1 + 1 + 1); // base + prof_adventurer(physique) + bg_refugee(physique:1) + bg_secret_debt(physique:1)
    expect(attrs.finesse).toBe(2);
    expect(attrs.mind).toBe(2);
  });

  it('applies mage profession bonus to mind', () => {
    const attrs = cc.calculateAttributes('race_elf', 'prof_mage', ['bg_seeker']);
    expect(attrs.mind).toBe(2 + 1 + 1); // base + prof_mage(mind) + bg_seeker(mind:1)
    expect(attrs.physique).toBe(2);
    expect(attrs.finesse).toBe(2);
  });
});

describe('buildCharacter', () => {
  it('builds adventurer with correct HP and attributes', () => {
    const char = cc.buildCharacter({
      name: '测试勇者',
      raceId: 'race_human',
      professionId: 'prof_adventurer',
      backgroundIds: ['bg_refugee', 'bg_secret_debt'],
    });

    expect(char.name).toBe('测试勇者');
    expect(char.race).toBe('人类');
    expect(char.profession).toBe('冒险者');
    expect(char.hp).toBe(30);
    expect(char.maxHp).toBe(30);
    expect(char.mp).toBe(8);
    expect(char.gold).toBe(10);
    expect(char.attributes.physique).toBe(5);
    expect(char.tags).toContain('newcomer');
    expect(char.tags).toContain('adaptable');
    expect(char.tags).toContain('refugee');
    expect(char.equipment.weapon).toBe('iron_sword');
    expect(char.equipment.armor).toBe('leather_armor');
  });

  it('builds mage with HP 20 and MP 12', () => {
    const char = cc.buildCharacter({
      name: '测试法师',
      raceId: 'race_elf',
      professionId: 'prof_mage',
      backgroundIds: ['bg_merchant', 'bg_secret_noble'],
    });

    expect(char.hp).toBe(20);
    expect(char.maxHp).toBe(20);
    expect(char.mp).toBe(12);
    expect(char.gold).toBe(8);
    expect(char.equipment.weapon).toBe('wooden_staff');
  });

  it('builds rogue with HP 25 and gold 15', () => {
    const char = cc.buildCharacter({
      name: '测试游侠',
      raceId: 'race_dwarf',
      professionId: 'prof_rogue',
      backgroundIds: ['bg_outlaw'],
    });

    expect(char.hp).toBe(25);
    expect(char.gold).toBe(15);
    expect(char.tags).toContain('sturdy');
    expect(char.tags).toContain('stealth');
    expect(char.tags).toContain('outlaw');
  });
});

describe('getPresetTemplates', () => {
  it('returns 3 templates with valid IDs', () => {
    const templates = cc.getPresetTemplates();
    expect(templates).toHaveLength(3);
    for (const t of templates) {
      expect(codexEntries.has(t.raceId)).toBe(true);
      expect(codexEntries.has(t.professionId)).toBe(true);
      for (const bgId of t.backgroundIds) {
        expect(codexEntries.has(bgId)).toBe(true);
      }
    }
  });

  it('templates can build valid characters', () => {
    const templates = cc.getPresetTemplates();
    for (const t of templates) {
      const char = cc.buildCharacter({
        name: t.label,
        raceId: t.raceId,
        professionId: t.professionId,
        backgroundIds: t.backgroundIds,
      });
      expect(char.hp).toBeGreaterThan(0);
      expect(char.tags).toContain('newcomer');
    }
  });
});

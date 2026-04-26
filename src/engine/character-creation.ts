import type { CodexEntry, Race, Profession, Background } from '../codex/schemas/entry-types';
import { queryByType, queryById } from '../codex/query';
import type { PlayerState } from '../state/player-store';

type CharacterSelections = {
  readonly name: string;
  readonly raceId: string;
  readonly professionId: string;
  readonly backgroundIds: readonly string[];
};

type PresetTemplate = {
  readonly id: string;
  readonly label: string;
  readonly raceId: string;
  readonly professionId: string;
  readonly backgroundIds: readonly string[];
};

type CharacterCreation = {
  readonly getAvailableRaces: () => readonly Race[];
  readonly getAvailableProfessions: () => readonly Profession[];
  readonly getBackgroundHooks: (question: string) => readonly Background[];
  readonly calculateAttributes: (
    raceId: string,
    professionId: string,
    backgroundIds: readonly string[],
  ) => Record<string, number>;
  readonly buildCharacter: (selections: CharacterSelections) => PlayerState;
  readonly getPresetTemplates: () => readonly PresetTemplate[];
};

const BASE_ATTRIBUTES = { physique: 2, finesse: 2, mind: 2 } as const;

const PROFESSION_STATS: Record<string, { hp: number; mp: number; gold: number }> = {
  prof_adventurer: { hp: 30, mp: 8, gold: 10 },
  prof_mage: { hp: 20, mp: 12, gold: 8 },
  prof_rogue: { hp: 25, mp: 8, gold: 15 },
};

const DEFAULT_STATS = { hp: 25, mp: 8, gold: 10 };

const EQUIPMENT_SLOT_ORDER = ['weapon', 'armor', 'accessory'] as const;

export function createCharacterCreation(codexEntries: Map<string, CodexEntry>): CharacterCreation {
  const getAvailableRaces = (): readonly Race[] =>
    queryByType(codexEntries, 'race').filter(
      (e) => e.tags.includes('playable'),
    ) as Race[];

  const getAvailableProfessions = (): readonly Profession[] =>
    queryByType(codexEntries, 'profession') as Profession[];

  const getBackgroundHooks = (question: string): readonly Background[] =>
    (queryByType(codexEntries, 'background') as Background[]).filter(
      (bg) => bg.question === question,
    );

  const calculateAttributes = (
    raceId: string,
    professionId: string,
    backgroundIds: readonly string[],
  ): Record<string, number> => {
    const attrs: Record<string, number> = { ...BASE_ATTRIBUTES };

    const profession = queryById(codexEntries, professionId) as Profession | undefined;
    if (profession) {
      attrs[profession.primary_attribute] = (attrs[profession.primary_attribute] ?? 0) + 1;
    }

    for (const bgId of backgroundIds) {
      const bg = queryById(codexEntries, bgId) as Background | undefined;
      if (bg?.attribute_bias) {
        for (const [attr, value] of Object.entries(bg.attribute_bias)) {
          if (value !== undefined && attr in attrs) {
            (attrs as Record<string, number>)[attr] = ((attrs as Record<string, number>)[attr] ?? 0) + value;
          }
        }
      }
    }

    return attrs;
  };

  const buildCharacter = (selections: CharacterSelections): PlayerState => {
    const race = queryById(codexEntries, selections.raceId) as Race | undefined;
    const profession = queryById(codexEntries, selections.professionId) as Profession | undefined;

    const attributes = calculateAttributes(
      selections.raceId,
      selections.professionId,
      selections.backgroundIds,
    );

    const stats = PROFESSION_STATS[selections.professionId] ?? DEFAULT_STATS;

    const tags: string[] = ['newcomer'];
    if (race) tags.push(...race.traits);
    if (profession) tags.push(...profession.tags);
    for (const bgId of selections.backgroundIds) {
      const bg = queryById(codexEntries, bgId) as Background | undefined;
      if (bg) tags.push(...bg.starting_tags);
    }

    const equipment: Record<string, string | null> = {
      weapon: null,
      armor: null,
      accessory: null,
    };
    if (profession) {
      for (let i = 0; i < profession.starting_equipment.length && i < EQUIPMENT_SLOT_ORDER.length; i++) {
        equipment[EQUIPMENT_SLOT_ORDER[i]] = profession.starting_equipment[i];
      }
    }

    return {
      name: selections.name,
      race: race?.name ?? selections.raceId,
      profession: profession?.name ?? selections.professionId,
      hp: stats.hp,
      maxHp: stats.hp,
      mp: stats.mp,
      maxMp: stats.mp,
      gold: stats.gold,
      attributes,
      tags,
      equipment,
    };
  };

  const getPresetTemplates = (): readonly PresetTemplate[] => [
    {
      id: 'preset_north_ranger',
      label: '北境游侠',
      raceId: 'race_human',
      professionId: 'prof_rogue',
      backgroundIds: ['bg_refugee', 'bg_secret_debt'],
    },
    {
      id: 'preset_noble_mage',
      label: '落魄法师',
      raceId: 'race_elf',
      professionId: 'prof_mage',
      backgroundIds: ['bg_merchant', 'bg_secret_noble'],
    },
    {
      id: 'preset_wandering_rogue',
      label: '流浪矮人',
      raceId: 'race_dwarf',
      professionId: 'prof_rogue',
      backgroundIds: ['bg_outlaw', 'bg_secret_magic'],
    },
  ];

  return {
    getAvailableRaces,
    getAvailableProfessions,
    getBackgroundHooks,
    calculateAttributes,
    buildCharacter,
    getPresetTemplates,
  };
}

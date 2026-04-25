import { describe, it, expect } from "bun:test";
import {
  accumulateWeights,
  resolveCharacter,
  createInitialWeights,
} from "./weight-resolver";
import type {
  DialogueOptionEffect,
  TiebreakerConfig,
  AccumulatedWeights,
} from "./weight-resolver";

const DEFAULT_TIEBREAKER: TiebreakerConfig = {
  archetypePriority: {
    profession: ["prof_adventurer", "prof_mage", "prof_rogue"],
    background: [
      "bg_refugee",
      "bg_seeker",
      "bg_outlaw",
      "bg_merchant",
      "bg_secret_magic",
      "bg_secret_debt",
      "bg_secret_noble",
    ],
  },
  questionPriority: {
    profession: 1,
    background: 2,
  },
};

describe("weight-resolver", () => {
  describe("accumulateWeights", () => {
    it("with empty initial + one option effect returns correct weights", () => {
      const initial = createInitialWeights();
      const effect: DialogueOptionEffect = {
        raceId: "race_human",
        professionWeights: { prof_adventurer: 1 },
        backgroundWeights: {},
        tags: ["northern_origin"],
      };

      const result = accumulateWeights(initial, effect, 0);

      expect(result.raceId).toBe("race_human");
      expect(result.professionWeights).toEqual({ prof_adventurer: 1 });
      expect(result.backgroundWeights).toEqual({});
      expect(result.tags).toEqual(["northern_origin"]);
      expect(result.roundEffects).toHaveLength(1);
    });

    it("across 2 rounds sums professionWeights correctly", () => {
      const initial = createInitialWeights();
      const effect1: DialogueOptionEffect = {
        raceId: "race_human",
        professionWeights: { prof_adventurer: 1 },
        backgroundWeights: {},
        tags: ["northern_origin"],
      };
      const effect2: DialogueOptionEffect = {
        professionWeights: { prof_adventurer: 3, prof_rogue: 1 },
        backgroundWeights: { bg_refugee: 1 },
        tags: ["fighter"],
      };

      const after1 = accumulateWeights(initial, effect1, 0);
      const after2 = accumulateWeights(after1, effect2, 1);

      expect(after2.professionWeights.prof_adventurer).toBe(4);
      expect(after2.professionWeights.prof_rogue).toBe(1);
      expect(after2.backgroundWeights.bg_refugee).toBe(1);
    });

    it("returns NEW object each time (referential inequality)", () => {
      const initial = createInitialWeights();
      const effect: DialogueOptionEffect = {
        raceId: "race_elf",
        professionWeights: { prof_mage: 1 },
        backgroundWeights: {},
        tags: [],
      };

      const result = accumulateWeights(initial, effect, 0);

      expect(result).not.toBe(initial);
      expect(result.professionWeights).not.toBe(initial.professionWeights);
      expect(result.backgroundWeights).not.toBe(initial.backgroundWeights);
      expect(result.tags).not.toBe(initial.tags);
      expect(result.roundEffects).not.toBe(initial.roundEffects);
    });

    it("preserves raceId from round 1 across subsequent rounds", () => {
      const initial = createInitialWeights();
      const effect1: DialogueOptionEffect = {
        raceId: "race_dwarf",
        professionWeights: { prof_rogue: 1 },
        backgroundWeights: {},
        tags: [],
      };
      const effect2: DialogueOptionEffect = {
        professionWeights: { prof_rogue: 3 },
        backgroundWeights: { bg_outlaw: 1 },
        tags: [],
      };

      const after1 = accumulateWeights(initial, effect1, 0);
      const after2 = accumulateWeights(after1, effect2, 1);

      expect(after2.raceId).toBe("race_dwarf");
    });
  });

  describe("resolveCharacter", () => {
    it("picks highest-weighted profession (clear winner)", () => {
      const weights: AccumulatedWeights = {
        raceId: "race_human",
        professionWeights: {
          prof_adventurer: 5,
          prof_mage: 2,
          prof_rogue: 1,
        },
        backgroundWeights: {
          bg_refugee: 4,
          bg_seeker: 2,
          bg_secret_debt: 1,
        },
        tags: [],
        roundEffects: [],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.professionId).toBe("prof_adventurer");
    });

    it("picks top-2 backgrounds by weight", () => {
      const weights: AccumulatedWeights = {
        raceId: "race_human",
        professionWeights: { prof_adventurer: 5 },
        backgroundWeights: {
          bg_refugee: 4,
          bg_seeker: 2,
          bg_secret_debt: 3,
          bg_outlaw: 1,
        },
        tags: [],
        roundEffects: [],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.backgroundIds).toHaveLength(2);
      expect(result.backgroundIds).toContain("bg_refugee");
      expect(result.backgroundIds).toContain("bg_secret_debt");
    });

    it("tiebreaker layer 1: last answer weight breaks profession tie", () => {
      const lastRoundEffect: DialogueOptionEffect = {
        professionWeights: { prof_mage: 2 },
        backgroundWeights: {},
        tags: [],
      };
      const weights: AccumulatedWeights = {
        raceId: "race_elf",
        professionWeights: { prof_adventurer: 4, prof_mage: 4 },
        backgroundWeights: { bg_refugee: 3 },
        tags: [],
        roundEffects: [
          {
            professionWeights: { prof_adventurer: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_adventurer: 3 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_mage: 2 },
            backgroundWeights: {},
            tags: [],
          },
          lastRoundEffect,
        ],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.professionId).toBe("prof_mage");
    });

    it("tiebreaker layer 2: question priority breaks background tie when last-answer equal", () => {
      const weights: AccumulatedWeights = {
        raceId: "race_human",
        professionWeights: { prof_adventurer: 5 },
        backgroundWeights: { bg_refugee: 4, bg_seeker: 4 },
        tags: [],
        roundEffects: [
          {
            professionWeights: {},
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: {},
            backgroundWeights: { bg_refugee: 1 },
            tags: [],
          },
          {
            professionWeights: {},
            backgroundWeights: { bg_refugee: 3, bg_seeker: 3 },
            tags: [],
          },
          {
            professionWeights: {},
            backgroundWeights: { bg_seeker: 1 },
            tags: [],
          },
        ],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.backgroundIds[0]).toBe("bg_refugee");
    });

    it("tiebreaker layer 3: archetypePriority breaks tie when layers 1+2 equal", () => {
      const weights: AccumulatedWeights = {
        raceId: "race_human",
        professionWeights: { prof_mage: 4, prof_rogue: 4 },
        backgroundWeights: { bg_refugee: 3 },
        tags: [],
        roundEffects: [
          {
            professionWeights: { prof_mage: 1, prof_rogue: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_mage: 1, prof_rogue: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_mage: 1, prof_rogue: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_mage: 1, prof_rogue: 1 },
            backgroundWeights: {},
            tags: [],
          },
        ],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.professionId).toBe("prof_mage");
    });

    it("tiebreaker layer 4: codex order breaks tie when all above equal", () => {
      const configWithCustomOrder: TiebreakerConfig = {
        archetypePriority: {
          profession: ["prof_rogue", "prof_adventurer"],
          background: ["bg_outlaw", "bg_refugee"],
        },
        questionPriority: { profession: 1, background: 2 },
      };

      const weights: AccumulatedWeights = {
        raceId: "race_human",
        professionWeights: { prof_rogue: 4, prof_adventurer: 4 },
        backgroundWeights: { bg_refugee: 3 },
        tags: [],
        roundEffects: [
          {
            professionWeights: { prof_rogue: 1, prof_adventurer: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_rogue: 1, prof_adventurer: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_rogue: 1, prof_adventurer: 1 },
            backgroundWeights: {},
            tags: [],
          },
          {
            professionWeights: { prof_rogue: 1, prof_adventurer: 1 },
            backgroundWeights: {},
            tags: [],
          },
        ],
      };

      const result = resolveCharacter(weights, configWithCustomOrder);

      expect(result.professionId).toBe("prof_rogue");
    });

    it("full 4-round scenario produces expected CharacterSelections", () => {
      const initial = createInitialWeights();

      const round1Effect: DialogueOptionEffect = {
        raceId: "race_human",
        professionWeights: { prof_adventurer: 1 },
        backgroundWeights: {},
        tags: ["northern_origin"],
      };
      const round2Effect: DialogueOptionEffect = {
        professionWeights: { prof_adventurer: 3, prof_rogue: 1 },
        backgroundWeights: { bg_refugee: 1 },
        tags: ["fighter"],
      };
      const round3Effect: DialogueOptionEffect = {
        professionWeights: { prof_adventurer: 1 },
        backgroundWeights: { bg_refugee: 3, bg_seeker: 1 },
        tags: ["war_refugee"],
      };
      const round4Effect: DialogueOptionEffect = {
        professionWeights: { prof_adventurer: 2 },
        backgroundWeights: { bg_secret_debt: 3, bg_secret_magic: 1 },
        tags: ["pursued", "secret_revealed"],
      };

      let weights = accumulateWeights(initial, round1Effect, 0);
      weights = accumulateWeights(weights, round2Effect, 1);
      weights = accumulateWeights(weights, round3Effect, 2);
      weights = accumulateWeights(weights, round4Effect, 3);

      expect(weights.professionWeights.prof_adventurer).toBe(7);
      expect(weights.professionWeights.prof_rogue).toBe(1);
      expect(weights.backgroundWeights.bg_refugee).toBe(4);
      expect(weights.backgroundWeights.bg_secret_debt).toBe(3);

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.raceId).toBe("race_human");
      expect(result.professionId).toBe("prof_adventurer");
      expect(result.backgroundIds).toContain("bg_refugee");
      expect(result.backgroundIds).toContain("bg_secret_debt");
      expect(result.name).toBe("");
    });

    it("returns object with name as empty string", () => {
      const weights: AccumulatedWeights = {
        raceId: "race_elf",
        professionWeights: { prof_mage: 5 },
        backgroundWeights: { bg_seeker: 4, bg_secret_magic: 3 },
        tags: [],
        roundEffects: [],
      };

      const result = resolveCharacter(weights, DEFAULT_TIEBREAKER);

      expect(result.name).toBe("");
      expect(result.raceId).toBe("race_elf");
      expect(result.professionId).toBe("prof_mage");
      expect(result.backgroundIds).toHaveLength(2);
    });
  });
});

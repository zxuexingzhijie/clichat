import { describe, it, expect } from "bun:test";
import { resolve } from "path";

const GUARD_DIALOGUE_PATH = resolve(
  import.meta.dir,
  "../../world-data/codex/guard-dialogue.yaml",
);

describe("guard-dialogue-loader", () => {
  describe("loadGuardDialogue", () => {
    it("loads guard-dialogue.yaml and returns a valid config with 4 rounds", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      expect(config.rounds).toHaveLength(4);
    });

    it("each round has at least 2 options with id, label, description, effects", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      for (const round of config.rounds) {
        expect(round.options.length).toBeGreaterThanOrEqual(2);
        for (const opt of round.options) {
          expect(typeof opt.id).toBe("string");
          expect(typeof opt.label).toBe("string");
          expect(typeof opt.description).toBe("string");
          expect(opt.effects).toBeDefined();
        }
      }
    });

    it("round 1 options all have a raceId in effects", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      const round1 = config.rounds[0];
      expect(round1.round).toBe(1);
      for (const opt of round1.options) {
        expect(opt.effects.raceId).toBeDefined();
        expect(opt.effects.raceId).toMatch(/^race_/);
      }
    });

    it("all rounds have a non-empty guardPromptHint string", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      for (const round of config.rounds) {
        expect(typeof round.guardPromptHint).toBe("string");
        expect(round.guardPromptHint.length).toBeGreaterThan(0);
      }
    });

    it("namePool has at least 10 entries", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      expect(config.namePool.length).toBeGreaterThanOrEqual(10);
    });

    it("archetypePriority.profession and archetypePriority.background are non-empty arrays", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const config = await loadGuardDialogue(GUARD_DIALOGUE_PATH);
      expect(config.archetypePriority.profession.length).toBeGreaterThan(0);
      expect(config.archetypePriority.background.length).toBeGreaterThan(0);
    });

    it("throws on malformed YAML with missing rounds field", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const tmpPath = resolve(
        import.meta.dir,
        "../../world-data/codex/__test_invalid_guard.yaml",
      );
      const invalidYaml = `namePool:\n  - test\narchetypePriority:\n  profession: [a]\n  background: [b]\n`;
      await Bun.write(tmpPath, invalidYaml);
      try {
        await expect(loadGuardDialogue(tmpPath)).rejects.toThrow();
      } finally {
        const { unlinkSync } = await import("fs");
        unlinkSync(tmpPath);
      }
    });

    it("throws on YAML with invalid option missing effects", async () => {
      const { loadGuardDialogue } = await import("./guard-dialogue-loader.ts");
      const tmpPath = resolve(
        import.meta.dir,
        "../../world-data/codex/__test_bad_option.yaml",
      );
      const badYaml = `rounds:
  - round: 1
    guardPromptHint: test
    options:
      - id: test_opt
        label: Test
        description: Missing effects
      - id: test_opt2
        label: Test2
        description: Also missing
  - round: 2
    guardPromptHint: test2
    options:
      - id: o1
        label: L
        description: D
      - id: o2
        label: L
        description: D
  - round: 3
    guardPromptHint: test3
    options:
      - id: o1
        label: L
        description: D
      - id: o2
        label: L
        description: D
  - round: 4
    guardPromptHint: test4
    options:
      - id: o1
        label: L
        description: D
      - id: o2
        label: L
        description: D
archetypePriority:
  profession: [a]
  background: [b]
namePool:
  - name1
`;
      await Bun.write(tmpPath, badYaml);
      try {
        await expect(loadGuardDialogue(tmpPath)).rejects.toThrow();
      } finally {
        const { unlinkSync } = await import("fs");
        unlinkSync(tmpPath);
      }
    });
  });
});

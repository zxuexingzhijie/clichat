import { describe, test, expect } from "bun:test";
import { rollD20, rollPercentage, createSeededRng } from "./dice.ts";

describe("dice", () => {
  test("rollD20 returns integer 1-20", () => {
    for (let i = 0; i < 1000; i++) {
      const result = rollD20();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  test("rollD20 with seeded RNG returns same result", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    expect(rollD20(rng1)).toBe(rollD20(rng2));
  });

  test("rollPercentage returns integer 1-100", () => {
    for (let i = 0; i < 1000; i++) {
      const result = rollPercentage();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  test("createSeededRng produces repeatable sequence", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  test("different seeds produce different sequences", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(99);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

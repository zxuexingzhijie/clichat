import { describe, test, expect } from "bun:test";
import { resolveNormalCheck, resolveOpposedCheck, resolveProbabilityCheck, resolvePlotCriticalCheck } from "./adjudication.ts";
import { resolveAction } from "./rules-engine.ts";
import { createSeededRng } from "./dice.ts";

describe("adjudication - normal check", () => {
  test("roll=14, attrMod=3, dc=15: success", () => {
    const result = resolveNormalCheck({
      roll: 14, attributeName: "physique", attributeModifier: 3,
      skillModifier: 0, environmentModifier: 0, dc: 15,
    });
    expect(result.total).toBe(17);
    expect(result.grade).toBe("success");
  });

  test("nat20 always critical_success", () => {
    const result = resolveNormalCheck({
      roll: 20, attributeName: "physique", attributeModifier: -5,
      skillModifier: 0, environmentModifier: 0, dc: 99,
    });
    expect(result.grade).toBe("critical_success");
  });

  test("nat1 always critical_failure", () => {
    const result = resolveNormalCheck({
      roll: 1, attributeName: "mind", attributeModifier: 99,
      skillModifier: 0, environmentModifier: 0, dc: 1,
    });
    expect(result.grade).toBe("critical_failure");
  });

  test("total >= DC+10: great_success", () => {
    const result = resolveNormalCheck({
      roll: 15, attributeName: "physique", attributeModifier: 3,
      skillModifier: 2, environmentModifier: 0, dc: 10,
    });
    expect(result.total).toBe(20);
    expect(result.grade).toBe("great_success");
  });

  test("total < DC-5: failure", () => {
    const result = resolveNormalCheck({
      roll: 7, attributeName: "finesse", attributeModifier: 2,
      skillModifier: 0, environmentModifier: 0, dc: 15,
    });
    expect(result.total).toBe(9);
    expect(result.grade).toBe("failure");
  });

  test("DC-5 <= total < DC: partial_success", () => {
    const result = resolveNormalCheck({
      roll: 10, attributeName: "mind", attributeModifier: 2,
      skillModifier: 0, environmentModifier: 0, dc: 15,
    });
    expect(result.total).toBe(12);
    expect(result.grade).toBe("partial_success");
  });

  test("display format with Chinese labels", () => {
    const result = resolveNormalCheck({
      roll: 14, attributeName: "physique", attributeModifier: 3,
      skillModifier: 0, environmentModifier: 0, dc: 15,
    });
    expect(result.display).toContain("[D20: 14]");
    expect(result.display).toContain("体魄");
    expect(result.display).toContain("DC 15");
  });
});

describe("adjudication - opposed check", () => {
  test("higher total wins", () => {
    const rng = createSeededRng(42);
    const result = resolveOpposedCheck({
      attacker: { roll: 0, attributeName: "physique", attributeModifier: 5, skillModifier: 0, environmentModifier: 0 },
      defender: { roll: 0, attributeName: "physique", attributeModifier: 2, skillModifier: 0, environmentModifier: 0 },
    }, rng);
    expect(result.winner).toBeDefined();
    expect(["attacker", "defender"]).toContain(result.winner);
  });
});

describe("adjudication - probability check", () => {
  test("roll <= threshold: success", () => {
    const result = resolveProbabilityCheck({ threshold: 50, roll: 30 });
    expect(result.success).toBe(true);
  });

  test("roll > threshold: failure", () => {
    const result = resolveProbabilityCheck({ threshold: 50, roll: 70 });
    expect(result.success).toBe(false);
  });
});

describe("adjudication - plot critical", () => {
  test("includes narrative hint", () => {
    const result = resolvePlotCriticalCheck({
      roll: 15, attributeName: "mind", attributeModifier: 3,
      skillModifier: 0, environmentModifier: 0, dc: 12,
    });
    expect(result.narrativeHint).toBeDefined();
    expect(result.narrativeHint.length).toBeGreaterThan(0);
  });
});

describe("rules-engine facade", () => {
  test("resolveAction returns valid CheckResult", () => {
    const rng = createSeededRng(42);
    const result = resolveAction(
      { type: "attack", target: "goblin" },
      { attributeName: "physique", attributeModifier: 3, skillModifier: 1, environmentModifier: 0, dc: 12 },
      rng,
    );
    expect(result.roll).toBeGreaterThanOrEqual(1);
    expect(result.roll).toBeLessThanOrEqual(20);
    expect(result.grade).toBeDefined();
    expect(result.display).toContain("[D20:");
  });

  test("deterministic with seeded RNG", () => {
    const rng1 = createSeededRng(99);
    const rng2 = createSeededRng(99);
    const ctx = { attributeName: "finesse" as const, attributeModifier: 2, skillModifier: 0, environmentModifier: 0, dc: 14 };
    const r1 = resolveAction({ type: "attack", target: "x" }, ctx, rng1);
    const r2 = resolveAction({ type: "attack", target: "x" }, ctx, rng2);
    expect(r1).toEqual(r2);
  });
});

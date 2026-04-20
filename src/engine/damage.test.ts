import { describe, test, expect } from "bun:test";
import { calculateDamage, getGradeBonus } from "./damage.ts";

describe("damage", () => {
  test("grade bonus mapping", () => {
    expect(getGradeBonus("critical_success")).toBe(4);
    expect(getGradeBonus("great_success")).toBe(3);
    expect(getGradeBonus("success")).toBe(2);
    expect(getGradeBonus("partial_success")).toBe(1);
    expect(getGradeBonus("failure")).toBe(0);
    expect(getGradeBonus("critical_failure")).toBe(0);
  });

  test("damage formula: 5 + 3 + 2(success) - 3 = 7", () => {
    const result = calculateDamage({
      weaponBase: 5,
      attributeModifier: 3,
      grade: "success",
      armorReduction: 3,
    });
    expect(result.total).toBe(7);
    expect(result.gradeBonus).toBe(2);
  });

  test("damage floors at 0", () => {
    const result = calculateDamage({
      weaponBase: 5,
      attributeModifier: 1,
      grade: "failure",
      armorReduction: 8,
    });
    expect(result.total).toBe(0);
  });

  test("critical success adds 4 bonus", () => {
    const result = calculateDamage({
      weaponBase: 5,
      attributeModifier: 3,
      grade: "critical_success",
      armorReduction: 3,
    });
    expect(result.total).toBe(9);
    expect(result.gradeBonus).toBe(4);
  });
});

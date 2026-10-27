import { describe, expect, it } from "vitest";
import { validatePassword } from "./validator";

describe("validatePassword", () => {
  it("marks a weak password and returns actionable suggestions", () => {
    const result = validatePassword("abc");
    expect(result.strength).toBe("VERY_WEAK");
    expect(result.checks.minimumLength).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("recognizes a password meeting every requirement", () => {
    const result = validatePassword("ValidPass9!");
    expect(result.score).toBe(5);
    expect(result.strength).toBe("VERY_STRONG");
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });
});

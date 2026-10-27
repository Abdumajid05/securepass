import { describe, expect, it } from "vitest";
import { generatePassword } from "./generator";

describe("generatePassword", () => {
  it("returns the configured length with all required character groups", () => {
    const password = generatePassword({
      length: 20,
      lowercase: true,
      uppercase: true,
      numbers: true,
      specialCharacters: true,
    });
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("rejects configurations without a character group", () => {
    expect(() => generatePassword({
      length: 20,
      lowercase: false,
      uppercase: false,
      numbers: false,
      specialCharacters: false,
    })).toThrow();
  });
});

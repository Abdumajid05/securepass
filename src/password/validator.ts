import type {
  PasswordChecks,
  PasswordStrength,
  PasswordValidation,
} from "../types";

export function validatePassword(password: string): PasswordValidation {
  const checks: PasswordChecks = {
    minimumLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    specialCharacter: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const strengthByScore: PasswordStrength[] = [
    "VERY_WEAK",
    "VERY_WEAK",
    "WEAK",
    "MEDIUM",
    "STRONG",
    "VERY_STRONG",
  ];
  const suggestions: string[] = [];

  if (!checks.minimumLength) suggestions.push("Kamida 8 ta belgidan foydalaning.");
  if (!checks.uppercase) suggestions.push("Katta harf qo‘shing.");
  if (!checks.lowercase) suggestions.push("Kichik harf qo‘shing.");
  if (!checks.number) suggestions.push("Raqam qo‘shing.");
  if (!checks.specialCharacter) suggestions.push("Maxsus belgi qo‘shing.");
  if (password.length >= 8 && password.length < 12) {
    suggestions.push("Xavfsizlikni oshirish uchun 12 yoki undan ko‘p belgidan foydalaning.");
  }

  return {
    score,
    strength: strengthByScore[score],
    checks,
    suggestions,
  };
}

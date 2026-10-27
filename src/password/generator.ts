import type { PasswordGeneratorOptions } from "../types";

const CHARACTER_GROUPS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  specialCharacters: "!@#$%^&*()-_=+[]{};:,.<>?",
} satisfies Record<keyof Omit<PasswordGeneratorOptions, "length">, string>;

const PASSPHRASE_WORDS = `amber anchor apple apron atlas bamboo barley beacon berry birch blanket blossom bluebird breeze brick brook cactus candle canyon captain carpet castle cedar celery cherry circle cobalt comet compass cookie copper cosmos cricket crystal daisy delta desert dolphin drum eagle earth echo ember engine falcon feather fern festival fig finch flame flower forest fossil galaxy garden garlic glacier gold granite guitar harbor hazel helmet honey horizon island ivory jacket jasmine jazz jewel kernel kettle keyboard kiwi lagoon lantern lavender lemon library linen lotus marble meadow melon melody meteor mint mirror moon morning mountain museum nectar notebook ocean olive orange orbit orchid otter palace panda paper parsley peach pepper phoenix piano picnic planet plum pocket poem pollen pumpkin quartz rabbit rainbow raven reef river robin rocket`.split(" ");

function secureRandomIndex(max: number): number {
  if (!Number.isSafeInteger(max) || max < 1 || max > 256) {
    throw new Error("Tasodifiy tanlash oralig‘i yaroqsiz.");
  }
  const limit = 256 - (256 % max);
  const value = new Uint8Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}

export function generatePassphrase(wordCount = 7): string {
  if (!Number.isInteger(wordCount) || wordCount < 4 || wordCount > 12) {
    throw new Error("Ibora 4 dan 12 tagacha so‘zdan iborat bo‘lsin.");
  }
  return Array.from(
    { length: wordCount },
    () => PASSPHRASE_WORDS[secureRandomIndex(PASSPHRASE_WORDS.length)],
  ).join("-");
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  if (!Number.isInteger(options.length) || options.length < 4 || options.length > 128) {
    throw new Error("Parol uzunligi 4 dan 128 tagacha bo‘lishi kerak.");
  }

  const enabledGroups = Object.entries(CHARACTER_GROUPS)
    .filter(([name]) => options[name as keyof typeof CHARACTER_GROUPS])
    .map(([, characters]) => characters);
  if (enabledGroups.length === 0) {
    throw new Error("Kamida bitta belgi turini tanlang.");
  }
  if (options.length < enabledGroups.length) {
    throw new Error("Uzunlik tanlangan belgilar guruhlari sonidan kam bo‘lmasin.");
  }

  const allCharacters = enabledGroups.join("");
  const passwordCharacters = enabledGroups.map(
    (group) => group[secureRandomIndex(group.length)],
  );
  while (passwordCharacters.length < options.length) {
    passwordCharacters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [
      passwordCharacters[swapIndex],
      passwordCharacters[index],
    ];
  }
  return passwordCharacters.join("");
}

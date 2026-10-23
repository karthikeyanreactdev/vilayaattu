export const LOCALES = [
  { id: "en", short: "EN", native: "English" },
  { id: "ta", short: "த", native: "தமிழ்" },
  { id: "hi", short: "हि", native: "हिन्दी" },
  { id: "ml", short: "മ", native: "മലയാളം" },
  { id: "kn", short: "ಕ", native: "ಕನ್ನಡ" },
  { id: "te", short: "తె", native: "తెలుగు" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.id === value);
}

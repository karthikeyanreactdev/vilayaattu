/**
 * Theme configuration. Colour tokens themselves live in globals.css
 * (light under :root, dark under .dark); this file describes the options
 * the UI offers and per-game surface presets.
 */

export type ThemeMode = "light" | "dark" | "system";

export const THEME = {
  DEFAULT_MODE: "system" as ThemeMode,
  MODES: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ] as { value: ThemeMode; label: string }[],
  /** Class applied to <html> by next-themes. */
  ATTRIBUTE: "class" as const,
} as const;

/** Surface used behind each game board. Uses Tailwind classes backed by tokens. */
export const GAME_SURFACES = {
  felt: "felt text-white",
  wood: "wood-grain text-white",
  plain: "bg-card text-card-foreground",
  pitch: "bg-gradient-to-b from-emerald-700 to-emerald-900 text-white",
} as const;

export type GameSurface = keyof typeof GAME_SURFACES;

export const LAYOUT = {
  /** Max width for boards so they stay square and readable on any screen. */
  BOARD_MAX: "min(92vw, 560px)",
  CONTENT_MAX: "max-w-5xl",
} as const;

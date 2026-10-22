/**
 * App-wide constants. Everything tunable lives here so a future backend
 * (or a rebrand) only needs edits in one place.
 */

export const APP = {
  NAME: "Vilayaattu",
  TAMIL_NAME: "விளையாட்டு",
  TAGLINE: "Play together. No sign-up. Just share a code.",
  /** Unique id used to namespace P2P rooms. Change it to isolate deployments. */
  P2P_APP_ID: "vilayaattu-games-v1",
  VERSION: "0.1.0",
} as const;

export const API = {
  /** Future backend base URL. Unused while the app runs peer-to-peer. */
  BASE_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000",
  TIMEOUT_MS: 15_000,
  ENDPOINTS: {
    ROOMS: "/rooms",
    ROOM: (code: string) => `/rooms/${code}`,
    PROFILE: "/me",
    LEADERBOARD: "/leaderboard",
  },
} as const;

export type TransportKind = "p2p" | "local" | "socket";

export const NETWORK = {
  /**
   * p2p    – WebRTC through public Nostr relays (works across devices, no backend)
   * local  – BroadcastChannel (same browser, different tabs; handy for development)
   * socket – reserved for the future backend
   */
  TRANSPORT: (process.env.NEXT_PUBLIC_TRANSPORT as TransportKind) ?? "p2p",
  /** How long a guest waits for the host before showing "room not found". */
  HOST_WAIT_MS: 30_000,
  /** Public signalling relays used at once. More = slower start but more reliable discovery. */
  RELAY_REDUNDANCY: 10,
  /** Quick play: max time to listen for open rooms, and the grace period after the first answer. */
  MATCH_WAIT_MS: 15_000,
  MATCH_SETTLE_MS: 900,
  ADVERT_MS: 2_500,
  /** Host heartbeat; guests treat silence longer than HOST_TIMEOUT_MS as a lost host. */
  HEARTBEAT_MS: 3_000,
  HOST_TIMEOUT_MS: 12_000,
  TICK_MS: 250,
} as const;

export const ROOM = {
  CODE_LENGTH: 6,
  /** No 0/O, 1/I/L to avoid confusion when reading codes aloud. */
  CODE_ALPHABET: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  MAX_PLAYERS: 6,
} as const;

export const USER = {
  NAME_MIN: 2,
  NAME_MAX: 16,
  AVATARS: ["🐯", "🐐", "🦚", "🐘", "🐒", "🦁", "🐢", "🦜", "🐟", "🐂", "🦊", "🐼"],
} as const;

export const STORAGE_KEYS = {
  USER: "vt:user",
  PLAYER_ID: "vt:player-id",
  SETTINGS: "vt:settings",
  TOUR_DONE: "vt:tour-done",
  HOST_SESSION: (code: string) => `vt:host:${code}`,
} as const;

/** Distinct seat colours (work on light and dark). Index = seat number. */
export const PLAYER_COLORS = [
  { name: "Saffron", bg: "#f59e0b", fg: "#1c1917" },
  { name: "Peacock", bg: "#0ea5e9", fg: "#0c1a24" },
  { name: "Leaf", bg: "#22c55e", fg: "#0b1f12" },
  { name: "Kumkum", bg: "#ef4444", fg: "#fff" },
  { name: "Jamun", bg: "#a855f7", fg: "#fff" },
  { name: "Turmeric", bg: "#eab308", fg: "#1c1917" },
] as const;

export const COLORS = {
  SUIT_RED: "#dc2626",
  SUIT_BLACK: "#1f2937",
  ONNU: {
    red: "#e53935",
    yellow: "#fbc02d",
    green: "#43a047",
    blue: "#1e88e5",
    wild: "#212121",
  },
  CHESS: {
    light: "#f0d9b5",
    dark: "#b58863",
    highlight: "rgba(255, 213, 79, 0.55)",
    check: "rgba(239, 68, 68, 0.75)",
    hint: "rgba(0, 0, 0, 0.22)",
  },
} as const;

export const ANIMATION = {
  SPRING: { type: "spring", stiffness: 420, damping: 32, mass: 0.9 },
  SPRING_SOFT: { type: "spring", stiffness: 220, damping: 26 },
  SPRING_BOUNCY: { type: "spring", stiffness: 500, damping: 18 },
  EASE_OUT: [0.22, 1, 0.36, 1],
  SOW_STEP_MS: 170,
  CARD_DEAL_STAGGER: 0.035,
} as const;

export const ROUTES = {
  HOME: "/",
  ROOM: (code: string) => `/room/${code}`,
} as const;

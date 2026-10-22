import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { BotLevel, GameOptions, PlayerRef } from "@/games/types";

export type RoomPlayer = PlayerRef & { connected: boolean; bot?: BotLevel };

export type RoomStatus =
  | "idle"
  | "connecting"
  | "lobby"
  | "playing"
  | "not-found"
  | "host-lost"
  | "kicked"
  | "closed";

export type Roster = {
  hostId: string;
  players: RoomPlayer[];
  gameId: string | null;
  options: GameOptions;
  phase: "lobby" | "playing";
  /** Players seated in the current game (others spectate). */
  gamePlayers: PlayerRef[];
  /** Public rooms show up in quick play for their game. */
  isPublic: boolean;
  /** Seats at this table (players + computers). */
  capacity: number;
  /** Host can let everyone turn on a camera. */
  videoAllowed: boolean;
};

export type Reaction = { id: string; playerId: string; emoji: string };

export type RoomState = Roster & {
  code: string;
  isHost: boolean;
  status: RoomStatus;
  message: string | null;
  reactions: Reaction[];
};

const initialState: RoomState = {
  code: "",
  isHost: false,
  status: "idle",
  message: null,
  hostId: "",
  players: [],
  gameId: null,
  options: {},
  phase: "lobby",
  gamePlayers: [],
  isPublic: false,
  capacity: 6,
  videoAllowed: false,
  reactions: [],
};

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    roomOpened(state, action: PayloadAction<{ code: string; isHost: boolean }>) {
      return { ...initialState, ...action.payload, status: "connecting" };
    },
    rosterReceived(state, action: PayloadAction<Roster>) {
      Object.assign(state, action.payload);
      const live = ["connecting", "lobby", "playing", "host-lost", "not-found"];
      if (live.includes(state.status)) {
        state.status = action.payload.phase;
      }
    },
    statusChanged(state, action: PayloadAction<{ status: RoomStatus; message?: string }>) {
      state.status = action.payload.status;
      state.message = action.payload.message ?? null;
    },
    reactionAdded(state, action: PayloadAction<Reaction>) {
      state.reactions = [...state.reactions.slice(-12), action.payload];
    },
    reactionExpired(state, action: PayloadAction<string>) {
      state.reactions = state.reactions.filter((r) => r.id !== action.payload);
    },
    roomClosed() {
      return initialState;
    },
  },
});

export const {
  roomOpened,
  rosterReceived,
  statusChanged,
  reactionAdded,
  reactionExpired,
  roomClosed,
} = roomSlice.actions;
export default roomSlice.reducer;

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type GameSliceState = {
  gameId: string | null;
  /** The current player's view of the game state (secrets already removed). */
  view: unknown | null;
  seq: number;
  /** Host clock minus local clock in ms. */
  clockOffset: number;
};

const initialState: GameSliceState = { gameId: null, view: null, seq: -1, clockOffset: 0 };

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    viewReceived(
      state,
      action: PayloadAction<{ gameId: string | null; view: unknown; seq: number; hostNow: number }>,
    ) {
      const { gameId, view, seq, hostNow } = action.payload;
      // The host's seq only ever grows, so anything older is a stale packet.
      if (seq <= state.seq) return;
      state.gameId = gameId;
      state.view = view;
      state.seq = seq;
      state.clockOffset = hostNow - Date.now();
    },
    gameCleared() {
      return initialState;
    },
  },
});

export const { viewReceived, gameCleared } = gameSlice.actions;
export default gameSlice.reducer;

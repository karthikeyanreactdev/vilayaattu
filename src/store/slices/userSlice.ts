import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { STORAGE_KEYS, USER } from "@/config/constants";
import { sessionStore, storage } from "@/lib/storage";
import { pick, uid } from "@/lib/random";

export type UserState = {
  /** Stable player id, survives reloads so players can rejoin a game. */
  id: string;
  name: string;
  avatar: string;
  hydrated: boolean;
};

const initialState: UserState = { id: "", name: "", avatar: USER.AVATARS[0], hydrated: false };

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    hydrateUser(state) {
      const saved = storage.get<Partial<UserState>>(STORAGE_KEYS.USER);
      // Player id is per tab, so two tabs on one device are two players,
      // while a reload keeps the same id and rejoins the game.
      state.id = sessionStore.get<string>(STORAGE_KEYS.PLAYER_ID) || uid(12);
      sessionStore.set(STORAGE_KEYS.PLAYER_ID, state.id);
      state.name = saved?.name ?? "";
      state.avatar = saved?.avatar ?? pick(USER.AVATARS);
      state.hydrated = true;
      storage.set(STORAGE_KEYS.USER, { name: state.name, avatar: state.avatar });
    },
    setProfile(state, action: PayloadAction<{ name: string; avatar: string }>) {
      state.name = action.payload.name.trim();
      state.avatar = action.payload.avatar;
      storage.set(STORAGE_KEYS.USER, { name: state.name, avatar: state.avatar });
    },
  },
});

export const { hydrateUser, setProfile } = userSlice.actions;
export default userSlice.reducer;

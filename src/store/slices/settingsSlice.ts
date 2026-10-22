import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "@/config/constants";
import { storage } from "@/lib/storage";

export type SettingsState = {
  tourDone: boolean;
  /** Bumped to (re)start the guided tour from anywhere in the app. */
  tourRequest: number;
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  hydrated: boolean;
};

const initialState: SettingsState = {
  tourDone: true,
  tourRequest: 0,
  music: true,
  sfx: true,
  haptics: true,
  hydrated: false,
};

const persist = (s: SettingsState) =>
  storage.set(STORAGE_KEYS.SETTINGS, { tourDone: s.tourDone, music: s.music, sfx: s.sfx, haptics: s.haptics });

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    hydrateSettings(state) {
      const saved = storage.get<Partial<SettingsState>>(STORAGE_KEYS.SETTINGS);
      state.tourDone = saved?.tourDone ?? false;
      state.music = saved?.music ?? true;
      state.sfx = saved?.sfx ?? true;
      state.haptics = saved?.haptics ?? true;
      state.hydrated = true;
    },
    completeTour(state) {
      state.tourDone = true;
      persist(state);
    },
    requestTour(state) {
      state.tourRequest += 1;
    },
    setMusic(state, action: PayloadAction<boolean>) {
      state.music = action.payload;
      persist(state);
    },
    setSfx(state, action: PayloadAction<boolean>) {
      state.sfx = action.payload;
      persist(state);
    },
    setHaptics(state, action: PayloadAction<boolean>) {
      state.haptics = action.payload;
      persist(state);
    },
  },
});

export const { hydrateSettings, completeTour, requestTour, setMusic, setSfx, setHaptics } = settingsSlice.actions;
export default settingsSlice.reducer;

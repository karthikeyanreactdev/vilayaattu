import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "@/config/constants";
import { isLocale, type Locale } from "@/i18n/locales";
import { storage } from "@/lib/storage";

export type SettingsState = {
  tourDone: boolean;
  /** First visit to a room lobby. */
  lobbyTourDone: boolean;
  /** Bumped to (re)start the guided tour from anywhere in the app. */
  tourRequest: number;
  sfx: boolean;
  haptics: boolean;
  locale: Locale;
  hydrated: boolean;
};

const initialState: SettingsState = {
  tourDone: true,
  lobbyTourDone: true,
  tourRequest: 0,
  sfx: true,
  haptics: true,
  locale: "en",
  hydrated: false,
};

const persist = (s: SettingsState) =>
  storage.set(STORAGE_KEYS.SETTINGS, {
    tourDone: s.tourDone,
    lobbyTourDone: s.lobbyTourDone,
    sfx: s.sfx,
    haptics: s.haptics,
    locale: s.locale,
  });

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    hydrateSettings(state) {
      const saved = storage.get<Partial<SettingsState>>(STORAGE_KEYS.SETTINGS);
      state.tourDone = saved?.tourDone ?? false;
      state.lobbyTourDone = saved?.lobbyTourDone ?? saved?.tourDone ?? false;
      state.sfx = saved?.sfx ?? true;
      state.haptics = saved?.haptics ?? true;
      state.locale = isLocale(saved?.locale) ? saved.locale : "en";
      state.hydrated = true;
    },
    completeTour(state, action: PayloadAction<"home" | "lobby">) {
      if (action.payload === "lobby") state.lobbyTourDone = true;
      else state.tourDone = true;
      persist(state);
    },
    requestTour(state) {
      state.tourRequest += 1;
    },
    setSfx(state, action: PayloadAction<boolean>) {
      state.sfx = action.payload;
      persist(state);
    },
    setHaptics(state, action: PayloadAction<boolean>) {
      state.haptics = action.payload;
      persist(state);
    },
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      persist(state);
    },
  },
});

export const { hydrateSettings, completeTour, requestTour, setSfx, setHaptics, setLocale } = settingsSlice.actions;
export default settingsSlice.reducer;

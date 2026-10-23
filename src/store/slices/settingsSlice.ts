import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "@/config/constants";
import { isLocale, type Locale } from "@/i18n/locales";
import { storage } from "@/lib/storage";

export type SettingsState = {
  tourDone: boolean;
  /** Bumped to (re)start the guided tour from anywhere in the app. */
  tourRequest: number;
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  locale: Locale;
  hydrated: boolean;
};

const initialState: SettingsState = {
  tourDone: true,
  tourRequest: 0,
  music: false,
  sfx: true,
  haptics: true,
  locale: "en",
  hydrated: false,
};

const persist = (s: SettingsState) =>
  storage.set(STORAGE_KEYS.SETTINGS, { tourDone: s.tourDone, music: s.music, sfx: s.sfx, haptics: s.haptics, locale: s.locale });

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    hydrateSettings(state) {
      const saved = storage.get<Partial<SettingsState>>(STORAGE_KEYS.SETTINGS);
      state.tourDone = saved?.tourDone ?? false;
      state.music = saved?.music ?? false;
      state.sfx = saved?.sfx ?? true;
      state.haptics = saved?.haptics ?? true;
      state.locale = isLocale(saved?.locale) ? saved.locale : "en";
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
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      persist(state);
    },
  },
});

export const { hydrateSettings, completeTour, requestTour, setMusic, setSfx, setHaptics, setLocale } = settingsSlice.actions;
export default settingsSlice.reducer;

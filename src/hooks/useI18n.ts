"use client";

import { useEffect } from "react";
import { HOME } from "@/i18n/copy";
import { GAME_TEXT } from "@/i18n/games";
import { isLocale, type Locale } from "@/i18n/locales";
import type { GameMeta } from "@/games/types";
import { useAppDispatch, useAppSelector } from "@/store";
import { setLocale } from "@/store/slices/settingsSlice";

export function useI18n() {
  const dispatch = useAppDispatch();
  const saved = useAppSelector((s) => s.settings.locale);
  const hydrated = useAppSelector((s) => s.settings.hydrated);
  const locale: Locale = hydrated && isLocale(saved) ? saved : "en";

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return {
    locale,
    t: HOME[locale],
    setLocale: (next: Locale) => dispatch(setLocale(next)),
    game(meta: GameMeta) {
      const local = locale === "en" ? undefined : GAME_TEXT[meta.id]?.[locale];
      return {
        title: local?.name ?? meta.name,
        subtitle: local ? meta.name : "",
        tagline: local?.tagline ?? meta.tagline,
      };
    },
  };
}

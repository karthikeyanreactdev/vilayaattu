import type { DriveStep } from "driver.js";
import { TOUR, type TourCopy } from "@/i18n/tour";
import type { Locale } from "@/i18n/locales";

function step(element: string, title: string, description: string, side: "top" | "bottom", align: "start" | "end" = "start"): DriveStep {
  return { element, popover: { title, description, side, align } };
}

/** One short step per control, in page order. */
export function tourSteps(locale: Locale): Record<"home" | "lobby", DriveStep[]> {
  const t: TourCopy = TOUR[locale] ?? TOUR.en;
  return {
    home: [
      step('[data-tour="welcome"]', t.welcomeTitle, t.welcome, "bottom", "start"),
      step('[data-tour="sound"]', t.soundTitle, t.sound, "bottom", "end"),
      step('[data-tour="create"]', t.createTitle, t.create, "top", "start"),
      step('[data-tour="join"]', t.joinTitle, t.join, "top", "start"),
      step('[data-tour="game-card"]', t.gameTitle, t.game, "top", "start"),
    ],
    lobby: [
      step('[data-tour="room-code"]', t.codeTitle, t.code, "bottom", "start"),
      step('[data-tour="players"]', t.playersTitle, t.players, "bottom", "start"),
      step('[data-tour="game-picker"]', t.pickerTitle, t.picker, "bottom", "start"),
      step('[data-tour="start"]', t.startTitle, t.start, "top", "end"),
    ],
  };
}

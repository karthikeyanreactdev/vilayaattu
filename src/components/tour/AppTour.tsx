"use client";

import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { completeTour } from "@/store/slices/settingsSlice";
import { TOUR } from "@/i18n/tour";
import { tourSteps } from "./tourSteps";

type Page = "home" | "lobby";
type Props = { page: Page };

/**
 * Guided tour. Home runs once for a new player. The lobby runs once
 * the first time they host or join a room. The ? button replays the
 * tour for the screen they are on.
 *
 * driver.js does not call onDestroyed for the Done button unless the
 * active element is still set, so Done and the close button mark the
 * tour finished themselves. Escape and the overlay still use onDestroyed.
 * Unmount destroys with reason "api" and must not mark it finished.
 */
export function AppTour({ page }: Props) {
  const dispatch = useAppDispatch();
  const { tourDone, lobbyTourDone, tourRequest, hydrated, locale } = useAppSelector((s) => s.settings);
  const userName = useAppSelector((s) => s.user.name);
  const lastRequest = useRef(tourRequest);
  const done = page === "home" ? tourDone : lobbyTourDone;

  useEffect(() => {
    if (!hydrated) return;
    const requested = tourRequest !== lastRequest.current;
    lastRequest.current = tourRequest;
    const auto = !done && (page === "home" ? Boolean(userName) : true);
    if (!requested && !auto) return;

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;
    const timer = setTimeout(async () => {
      const { driver } = await import("driver.js");
      if (cancelled) return;
      const copy = TOUR[locale] ?? TOUR.en;
      const finish = () => dispatch(completeTour(page));
      const d = driver({
        animate: false,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        allowClose: true,
        smoothScroll: true,
        overlayOpacity: 0.62,
        stagePadding: 8,
        stageRadius: 16,
        popoverOffset: 14,
        skipMissingElement: true,
        waitForElement: 800,
        disableActiveInteraction: true,
        popoverClass: "vt-tour",
        nextBtnText: copy.next,
        prevBtnText: copy.back,
        doneBtnText: copy.done,
        steps: tourSteps(locale)[page],
        onNextClick: () => {
          if (!d.hasNextStep()) {
            finish();
            d.destroy();
            return;
          }
          d.moveNext();
        },
        onPrevClick: () => d.movePrevious(),
        onCloseClick: () => {
          finish();
          d.destroy();
        },
        onDestroyed: (_element, _step, opts) => {
          if (cancelled) return;
          if (opts.reason === "escape" || opts.reason === "overlay") finish();
        },
      });
      instance = d;
      d.drive();
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      instance?.destroy();
    };
  }, [page, tourRequest, done, hydrated, userName, locale, dispatch]);

  return null;
}

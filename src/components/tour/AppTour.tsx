"use client";

import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import { useAppDispatch, useAppSelector } from "@/store";
import { completeTour } from "@/store/slices/settingsSlice";
import { TOUR_STEPS } from "./tourSteps";

type Props = { page: keyof typeof TOUR_STEPS };

/**
 * Guided tour. Runs automatically once on the home page for new users,
 * and again whenever the "?" button in the header is pressed.
 */
export function AppTour({ page }: Props) {
  const dispatch = useAppDispatch();
  const { tourDone, tourRequest, hydrated } = useAppSelector((s) => s.settings);
  const userName = useAppSelector((s) => s.user.name);
  const lastRequest = useRef(tourRequest);

  useEffect(() => {
    if (!hydrated) return;
    const requested = tourRequest !== lastRequest.current;
    lastRequest.current = tourRequest;
    const auto = page === "home" && !tourDone && Boolean(userName);
    if (!requested && !auto) return;

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;
    const timer = setTimeout(async () => {
      const { driver } = await import("driver.js");
      if (cancelled) return;
      const steps = TOUR_STEPS[page].filter((s) => !s.element || document.querySelector(s.element as string));
      const d = driver({
        showProgress: true,
        allowClose: true,
        smoothScroll: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 14,
        popoverClass: "vt-tour",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Let's play!",
        steps,
        onDestroyed: () => dispatch(completeTour()),
      });
      instance = d;
      d.drive();
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      instance?.destroy();
    };
  }, [page, tourRequest, tourDone, hydrated, userName, dispatch]);

  return null;
}

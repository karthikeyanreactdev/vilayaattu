"use client";

import { useCallback } from "react";
import { soundEngine, type SfxName } from "@/lib/audio/soundEngine";
import { useAppSelector } from "@/store";

/** Play a sound effect, with optional haptic buzz on phones. */
export function useSound() {
  const haptics = useAppSelector((s) => s.settings.haptics);
  return useCallback(
    (name: SfxName, vibrate?: number | number[]) => {
      soundEngine.play(name);
      const activated = typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive;
      if (haptics && vibrate && activated && "vibrate" in navigator) {
        try {
          navigator.vibrate(vibrate);
        } catch {
          /* unsupported */
        }
      }
    },
    [haptics],
  );
}

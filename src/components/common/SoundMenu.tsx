"use client";

import { Volume2, VolumeX, Vibrate } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { soundEngine } from "@/lib/audio/soundEngine";
import { useHydrated } from "@/hooks/useHydrated";
import { useAppDispatch, useAppSelector } from "@/store";
import { setHaptics, setSfx } from "@/store/slices/settingsSlice";

/** Sound effects and vibration toggles. */
export function SoundMenu() {
  const { sfx, haptics } = useAppSelector((s) => s.settings);
  const dispatch = useAppDispatch();
  const hydrated = useHydrated();
  const muted = hydrated && !sfx;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Sound settings" data-tour="sound" />}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sound</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={sfx}
            onCheckedChange={(v) => {
              dispatch(setSfx(Boolean(v)));
              if (v) setTimeout(() => soundEngine.play("select"), 0);
            }}
          >
            <Volume2 /> Sound effects
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={haptics} onCheckedChange={(v) => dispatch(setHaptics(Boolean(v)))}>
            <Vibrate /> Vibration
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

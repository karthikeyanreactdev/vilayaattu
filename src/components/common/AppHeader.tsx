"use client";

import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHydrated } from "@/hooks/useHydrated";
import { useAppDispatch, useAppSelector } from "@/store";
import { requestTour } from "@/store/slices/settingsSlice";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { SoundMenu } from "./SoundMenu";
import { ProfileDialog } from "./ProfileDialog";
import { PlayerAvatar } from "./PlayerAvatar";

type Props = { left?: ReactNode; compactLogo?: boolean; showTour?: boolean };

export function AppHeader({ left, compactLogo, showTour = true }: Props) {
  const user = useAppSelector((s) => s.user);
  const hydrated = useHydrated();
  const dispatch = useAppDispatch();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
        {left ?? <Logo compact={compactLogo} />}
        <div className="ml-auto flex items-center gap-0.5">
          {showTour && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Take the tour" onClick={() => dispatch(requestTour())} />
                }
              >
                <CircleHelp className="size-5" />
              </TooltipTrigger>
              <TooltipContent>Take the tour</TooltipContent>
            </Tooltip>
          )}
          <SoundMenu />
          <ThemeToggle />
          {hydrated && user.name && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="ml-1 flex items-center gap-2 rounded-full py-1 pr-1 pl-3 transition-colors hover:bg-muted"
              data-tour="profile"
              aria-label="Edit profile"
            >
              <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{user.name}</span>
              <PlayerAvatar avatar={user.avatar} seat={0} size="sm" />
            </button>
          )}
        </div>
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}

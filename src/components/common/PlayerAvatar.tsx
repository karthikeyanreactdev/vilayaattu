"use client";

import { motion } from "motion/react";
import { PLAYER_COLORS } from "@/config/constants";
import { cn } from "@/lib/utils";

type Props = {
  avatar: string;
  seat: number;
  name?: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  connected?: boolean;
  showName?: boolean;
  badge?: React.ReactNode;
  className?: string;
};

const SIZES = { sm: "size-8 text-base", md: "size-11 text-xl", lg: "size-16 text-3xl" };

/** Emoji avatar with seat colour ring, active-turn glow and connection dot. */
export function PlayerAvatar({ avatar, seat, name, size = "md", active, connected = true, showName, badge, className }: Props) {
  const color = PLAYER_COLORS[seat % PLAYER_COLORS.length];
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative">
        {active && (
          <motion.span
            className="absolute -inset-1.5 rounded-full"
            style={{ boxShadow: `0 0 0 3px ${color.bg}, 0 0 18px 4px ${color.bg}` }}
            animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div
          className={cn(
            "relative grid place-items-center rounded-full bg-card shadow-sm transition-opacity",
            SIZES[size],
            !connected && "opacity-40 grayscale",
          )}
          style={{ boxShadow: `inset 0 0 0 2.5px ${color.bg}` }}
          title={name}
        >
          <span aria-hidden>{avatar}</span>
        </div>
        <span
          className={cn(
            "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
            connected ? "bg-success" : "bg-muted-foreground",
          )}
          aria-label={connected ? "online" : "offline"}
        />
        {badge !== undefined && badge !== null && (
          <span className="absolute -top-1.5 -right-2 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] leading-5 font-bold text-primary-foreground shadow">
            {badge}
          </span>
        )}
      </div>
      {showName && name && (
        <span className={cn("max-w-20 truncate text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
          {name}
        </span>
      )}
    </div>
  );
}

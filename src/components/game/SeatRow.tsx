"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import type { PlayerRef } from "@/games/types";
import { cn } from "@/lib/utils";

type Props = {
  players: PlayerRef[];
  activeId?: string | null;
  /** Small text under each name (e.g. "7 cards"). */
  caption?: (p: PlayerRef) => ReactNode;
  /** Extra element under the avatar (e.g. a mini card stack or a button). */
  extra?: (p: PlayerRef) => ReactNode;
  dim?: (p: PlayerRef) => boolean;
  className?: string;
};

/** Opponents across the top of a card table. Reused by every card game. */
export function SeatRow({ players, activeId, caption, extra, dim, className }: Props) {
  return (
    <div className={cn("flex items-start justify-center gap-3 overflow-x-auto px-2 py-1 sm:gap-6", className)}>
      {players.map((p) => (
        <motion.div
          key={p.id}
          layout
          className={cn("flex min-w-16 flex-col items-center gap-1 transition-opacity", dim?.(p) && "opacity-40")}
        >
          <PlayerAvatar avatar={p.avatar} seat={p.seat} active={activeId === p.id} size="md" />
          <span className="max-w-20 truncate text-xs font-semibold">{p.name}</span>
          {caption && <span className="text-[11px] text-white/75">{caption(p)}</span>}
          {extra?.(p)}
        </motion.div>
      ))}
    </div>
  );
}

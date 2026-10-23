"use client";

import { motion } from "motion/react";
import { Check, Clock, Users } from "lucide-react";
import { GameIcon } from "@/components/game/GameIcon";
import { playerRange } from "@/games/registry";
import type { GameMeta } from "@/games/types";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

type Props = {
  meta: GameMeta;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  compact?: boolean;
  index?: number;
};

/** Game card used in the catalogue and the lobby picker. */
export function GameTile({ meta, selected, disabled, disabledReason, onClick, compact, index = 0 }: Props) {
  const { game } = useI18n();
  const text = game(meta);
  const interactive = Boolean(onClick) && !disabled;
  // Without a click handler the tile is display-only (e.g. inside a sheet trigger).
  const Root = onClick ? motion.button : motion.div;
  return (
    <Root
      type={onClick ? "button" : undefined}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 26 }}
      whileHover={interactive ? { y: -4 } : undefined}
      whileTap={interactive ? { scale: 0.97 } : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive && Boolean(onClick)}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-shadow",
        interactive && "cursor-pointer hover:shadow-xl",
        selected ? "border-primary ring-2 ring-primary" : "border-border",
        disabled && "opacity-50",
      )}
    >
      <div className={cn("relative overflow-hidden bg-gradient-to-br text-white", meta.accent, compact ? "h-20" : "h-28")}>
        <div className="bg-kolam absolute inset-0 opacity-30" />
        <motion.span
          className="absolute right-2 bottom-1 drop-shadow-lg"
          aria-hidden
          whileHover={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.5 }}
        >
          <GameIcon id={meta.id} className={cn("text-white", compact ? "size-14" : "size-20")} />
        </motion.span>
        <span className="absolute top-3 left-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
          {meta.category}
        </span>
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-white text-primary"
          >
            <Check className="size-4" />
          </motion.span>
        )}
      </div>
      {/* Fixed-height text block so every tile in a grid is the same size. */}
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="indic truncate font-bold">{text.title}</h3>
        {text.subtitle && <p className="indic h-5 truncate text-xs leading-5 text-muted-foreground">{text.subtitle}</p>}
        {!compact && <p className="indic mt-1 line-clamp-2 h-10 text-sm leading-5 text-muted-foreground">{text.tagline}</p>}
        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {playerRange(meta)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {meta.duration}m
          </span>
        </div>
        <p className="h-4 text-xs leading-4 font-medium text-destructive">{disabled && disabledReason ? disabledReason : ""}</p>
      </div>
    </Root>
  );
}

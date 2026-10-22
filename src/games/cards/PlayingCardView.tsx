"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { isHidden, isRed, rankLabel, SUIT_SYMBOL, type MaybeCard } from "./deck";

import { CARD_SIZE as SIZE, type CardSize } from "./cardSizes";

export type { CardSize };

const FACE_ICON: Record<number, string> = { 11: "♞", 12: "♛", 13: "♚" };

/** Kolam-patterned card back. */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn("relative size-full overflow-hidden rounded-[inherit] border border-white/30 bg-gradient-to-br from-rose-700 to-rose-900 shadow", className)}>
      <div className="absolute inset-1 rounded-[inherit] border border-amber-200/50 bg-[radial-gradient(circle_at_1px_1px,rgba(253,230,138,0.55)_1px,transparent_0)] bg-[length:7px_7px]" />
      <div className="absolute inset-0 grid place-items-center text-amber-200/80">
        <span className="rotate-45 border border-amber-200/70 p-1.5" />
      </div>
    </div>
  );
}

type Props = {
  card: MaybeCard;
  size?: CardSize;
  selected?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  wild?: boolean;
  faceDown?: boolean;
  layoutId?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
};

/** A playing card that animates between hand, table and piles via layoutId. */
export function PlayingCardView({ card, size = "md", selected, playable, dimmed, wild, faceDown, layoutId, onClick, className, style }: Props) {
  const hidden = faceDown || isHidden(card);
  const interactive = Boolean(onClick);
  return (
    <motion.div
      layoutId={layoutId}
      layout={!layoutId}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      initial={false}
      animate={{ y: selected ? -18 : playable ? -6 : 0, opacity: dimmed ? 0.55 : 1 }}
      whileHover={interactive ? { y: selected ? -22 : -12 } : undefined}
      whileTap={interactive ? { scale: 0.95 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "relative shrink-0 select-none [transform-style:preserve-3d]",
        SIZE[size],
        interactive && "cursor-pointer",
        selected && "z-20",
        className,
      )}
      style={style}
      aria-label={hidden ? "Face-down card" : card.rank === 0 ? "Joker" : `${rankLabel(card.rank)} of ${card.suit}`}
    >
      {hidden ? (
        <CardBack />
      ) : (
        <div
          className={cn(
            "relative size-full overflow-hidden rounded-[inherit] border bg-gradient-to-br from-white to-stone-100 shadow-md",
            selected ? "border-primary ring-2 ring-primary" : playable ? "border-amber-400 ring-2 ring-amber-300/70" : "border-stone-300",
            isRed(card.suit) ? "text-red-600" : "text-stone-900",
          )}
        >
          {card.rank === 0 ? (
            <div className="grid size-full place-items-center bg-gradient-to-br from-fuchsia-100 to-amber-100">
              <span className={cn(size === "xs" ? "text-xs" : "text-2xl")}>🃏</span>
              {size !== "xs" && <span className="absolute bottom-0.5 text-[8px] font-black tracking-widest text-fuchsia-700">JOKER</span>}
            </div>
          ) : (
            <>
              <div className={cn("absolute top-0.5 left-1 flex flex-col items-center leading-none font-bold", size === "xs" ? "text-[8px]" : size === "sm" ? "text-xs" : "text-sm sm:text-base")}>
                <span>{rankLabel(card.rank)}</span>
                <span>{SUIT_SYMBOL[card.suit]}</span>
              </div>
              {size !== "xs" && (
                <>
                  <div className="absolute inset-0 grid place-items-center">
                    <span className={cn(size === "sm" ? "text-xl" : "text-3xl sm:text-4xl", card.rank > 10 && "drop-shadow")}>
                      {FACE_ICON[card.rank] ?? SUIT_SYMBOL[card.suit]}
                    </span>
                  </div>
                  <div className={cn("absolute right-1 bottom-0.5 flex rotate-180 flex-col items-center leading-none font-bold", size === "sm" ? "text-xs" : "text-sm sm:text-base")}>
                    <span>{rankLabel(card.rank)}</span>
                    <span>{SUIT_SYMBOL[card.suit]}</span>
                  </div>
                </>
              )}
            </>
          )}
          {wild && card.rank !== 0 && (
            <span className="absolute top-0.5 right-0.5 rounded bg-fuchsia-600 px-0.5 text-[8px] font-black text-white">★</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { Ban, RefreshCw } from "lucide-react";
import { COLORS as THEME_COLORS } from "@/config/constants";
import { cn } from "@/lib/utils";
import { CARD_FRAME, CARD_SIZE as SIZE, type CardSize } from "../cards/cardSizes";
import type { HiddenOnnu, OnnuCard as Card } from "./logic";

type Size = Exclude<CardSize, "sm">;

function Symbol({ value, size }: { value: Card["value"]; size: Size }) {
  const icon = size === "lg" ? "size-9" : "size-6";
  if (value === "skip") return <Ban className={icon} strokeWidth={3} />;
  if (value === "reverse") return <RefreshCw className={icon} strokeWidth={3} />;
  if (value === "draw2") return <span>+2</span>;
  if (value === "draw4") return <span>+4</span>;
  if (value === "wild")
    return (
      <span className="grid size-3/5 grid-cols-2 overflow-hidden rounded-full">
        {(["red", "yellow", "green", "blue"] as const).map((c) => (
          <span key={c} style={{ background: THEME_COLORS.ONNU[c] }} />
        ))}
      </span>
    );
  return <span>{value}</span>;
}

const corner = (v: Card["value"]) =>
  v === "skip" ? "⊘" : v === "reverse" ? "⇄" : v === "draw2" ? "+2" : v === "draw4" ? "+4" : v === "wild" ? "W" : v;

type Props = {
  card: Card | HiddenOnnu;
  size?: Size;
  playable?: boolean;
  dimmed?: boolean;
  layoutId?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
};

export function OnnuCardView({ card, size = "md", playable, dimmed, layoutId, onClick, style, className }: Props) {
  const hidden = "hidden" in card;
  const bg = hidden ? "#1f2937" : THEME_COLORS.ONNU[card.color];
  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      initial={false}
      animate={{ y: playable ? -6 : 0, opacity: dimmed ? 0.55 : 1 }}
      whileHover={onClick ? { y: -12 } : undefined}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        CARD_FRAME,
        "border-white/90",
        SIZE[size],
        onClick && "cursor-pointer",
        playable && "ring-2 ring-amber-300/70",
        className,
      )}
      style={{ background: bg, ...style }}
      aria-label={hidden ? "Face-down card" : `${card.color} ${card.value}`}
    >
      {hidden ? (
        <div className="grid size-full place-items-center">
          <span className="-rotate-12 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 px-1 text-[8px] font-black text-white sm:text-[10px]">
            {size === "xs" ? "" : "ONNU"}
          </span>
        </div>
      ) : (
        <>
          <div className="absolute inset-[12%] grid -rotate-12 place-items-center rounded-[50%] bg-white/95" />
          <div
            className={cn("absolute inset-0 grid place-items-center font-black italic", size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xs")}
            style={{ color: card.color === "wild" ? "#111" : bg, WebkitTextStroke: size === "xs" ? undefined : "1px rgba(0,0,0,0.25)" }}
          >
            {size !== "xs" ? <Symbol value={card.value} size={size} /> : corner(card.value)}
          </div>
          {size !== "xs" && (
            <>
              <span className="absolute top-0.5 left-1 text-xs font-black text-white drop-shadow">{corner(card.value)}</span>
              <span className="absolute right-1 bottom-0.5 rotate-180 text-xs font-black text-white drop-shadow">{corner(card.value)}</span>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

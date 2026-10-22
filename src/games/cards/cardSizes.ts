/**
 * One size scale for every card in every card game (Kazhuthai, Rummy, Onnu),
 * so cards look the same everywhere. Ratio is a standard 2.5 × 3.5 card.
 */
export type CardSize = "xs" | "sm" | "md" | "lg";

export const CARD_SIZE: Record<CardSize, string> = {
  xs: "w-6 h-[2.1rem] rounded-[4px]",
  sm: "w-11 h-[3.85rem] rounded-md",
  md: "w-14 h-[4.9rem] sm:w-16 sm:h-[5.6rem] rounded-lg",
  lg: "w-20 h-28 sm:w-24 sm:h-[8.4rem] rounded-xl",
};

/** Shared frame: border, shadow and hover lift are the same for all card types. */
export const CARD_FRAME = "relative shrink-0 select-none border shadow-md";

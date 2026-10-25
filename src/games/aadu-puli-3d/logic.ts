import type { GameRules } from "../types";
import { aaduPuli, type AaduPuliAction, type AaduPuliState } from "../aadu-puli/logic";

/** Same rules as Aadu Puli Attam, played on a 3D forest board. */
export const aaduPuli3d: GameRules<AaduPuliState, AaduPuliAction> = {
  ...aaduPuli,
  meta: {
    ...aaduPuli.meta,
    id: "aadu-puli-3d",
    name: "Aadu Puli 3D",
    tagline: "Walk the forest at goat height. Read the animals, then make your move.",
    emoji: "🐅",
    accent: "from-green-600 to-orange-500",
  },
};

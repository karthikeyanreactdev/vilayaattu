"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameBoardProps } from "./types";

/** UI for each game, code-split so players only download the game they play. */

function Loading() {
  return (
    <div className="grid flex-1 place-items-center p-10">
      <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBoard = ComponentType<GameBoardProps<any, any>>;

export const BOARDS: Record<string, AnyBoard> = {
  "hand-cricket": dynamic(() => import("./hand-cricket/Board"), { loading: Loading }),
  "book-cricket": dynamic(() => import("./book-cricket/Board"), { loading: Loading }),
  ludo: dynamic(() => import("./ludo/Board"), { loading: Loading }),
  pallanguzhi: dynamic(() => import("./pallanguzhi/Board"), { loading: Loading }),
  "aadu-puli": dynamic(() => import("./aadu-puli/Board"), { loading: Loading }),
  "aadu-puli-3d": dynamic(() => import("./aadu-puli-3d/Board"), { loading: Loading }),
  chess: dynamic(() => import("./chess/Board"), { loading: Loading }),
  "chess-3d": dynamic(() => import("./chess-3d/Board"), { loading: Loading }),
  kazhuthai: dynamic(() => import("./kazhuthai/Board"), { loading: Loading }),
  onnu: dynamic(() => import("./onnu/Board"), { loading: Loading }),
  rummy: dynamic(() => import("./rummy/Board"), { loading: Loading }),
};

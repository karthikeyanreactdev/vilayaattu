"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { GameBoardProps } from "../types";
import ChessBoard from "../chess/Board";
import type { ChessAction, ChessState } from "../chess/logic";
import { ChessShell } from "../chess/Shell";
import { useCanDraw3d, ViewButtons } from "../three/ViewButtons";
import type { ViewApi } from "../three/ViewRig";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-amber-100/80">Lining up the armies…</div>,
});

export default function Chess3dBoard(props: GameBoardProps<ChessState, ChessAction>) {
  const view = useRef<ViewApi | null>(null);
  const canDraw3d = useCanDraw3d();
  if (canDraw3d === false) return <ChessBoard {...props} />;
  return (
    <ChessShell
      props={props}
      className="max-w-4xl"
      board={(v) => (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-amber-950 to-stone-950 shadow-xl ring-1 ring-amber-900/40">
          <Scene state={props.state} view={v} viewApi={view} />
          <ViewButtons view={view} />
        </div>
      )}
    />
  );
}

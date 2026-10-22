"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { GameBoardProps } from "../types";
import AaduPuliBoard from "../aadu-puli/Board";
import { AaduPuliHeader, CaptureTally, useAaduPuliControls } from "../aadu-puli/controls";
import type { AaduPuliAction, AaduPuliState } from "../aadu-puli/logic";
import { useCanDraw3d, ViewButtons } from "../three/ViewButtons";
import type { ViewApi } from "../three/ViewRig";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-emerald-50/80">Growing the forest…</div>,
});

export default function AaduPuli3dBoard(props: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  const canDraw3d = useCanDraw3d();
  if (canDraw3d === false) return <AaduPuliBoard {...props} />;
  return <Board3d {...props} />;
}

function Board3d({ state, me, players, send }: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  const { role, myTurn, placing, selected, targets, movable, tap } = useAaduPuliControls(state, me, send);
  const view = useRef<ViewApi | null>(null);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-3 p-4 pb-24">
      <AaduPuliHeader state={state} me={me} players={players} myTurn={myTurn} placing={placing} selected={selected} role={role} />
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-sky-300 to-emerald-700 shadow-xl ring-1 ring-emerald-900/30">
        <Scene state={state} selected={selected} targets={targets} movable={movable} onTap={tap} viewApi={view} />
        <ViewButtons view={view} />
      </div>
      <CaptureTally captured={state.captured} captureGoal={state.captureGoal} />
      <p className="text-center text-[11px] text-muted-foreground">
        <a className="underline" href="https://sketchfab.com/3d-models/stylized-bengal-tiger-with-4-animations-d87e750f18aa416dbccdd5ca7b81f751" target="_blank" rel="noreferrer">
          Tiger
        </a>{" "}
        by Jungle Jim and{" "}
        <a className="underline" href="https://sketchfab.com/3d-models/lupe-goat-b48b9fefedfc4ec2991935f99b89b5e3" target="_blank" rel="noreferrer">
          goat
        </a>{" "}
        by jackiebatteau,{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}

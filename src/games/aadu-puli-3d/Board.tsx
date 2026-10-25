"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GameBoardProps } from "../types";
import AaduPuliBoard from "../aadu-puli/Board";
import { useAaduPuliControls } from "../aadu-puli/controls";
import type { AaduPuliAction, AaduPuliState } from "../aadu-puli/logic";
import { useCanDraw3d } from "../three/ViewButtons";
import { Hud } from "./Hud";
import { createWalkStore, spawnFor } from "./walk";
import type { WalkApi } from "./WalkRig";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-emerald-50/80">Growing the forest…</div>,
});

export default function AaduPuli3dBoard(props: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  const canDraw3d = useCanDraw3d();
  if (canDraw3d === false) return <AaduPuliBoard {...props} />;
  return <Board3d {...props} />;
}

/**
 * First-person Aadu Puli: you walk the clearing at goat height, read each
 * animal's mood up close, and keep track of the rest on the radar.
 */
function Board3d({ state, me, players, send }: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  const { role, myTurn, placing, selected, targets, movable, tap } = useAaduPuliControls(state, me, send);
  const [walk] = useState(() => createWalkStore(spawnFor(role)));
  const walkApi = useRef<WalkApi | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [aimed, setAimed] = useState<number | null>(null);
  const [flashAt, setFlashAt] = useState(0);

  // Time-stamp each move so the radar, trail and toast can fade it out.
  const lastMoveNo = useRef(state.moveNo);
  useEffect(() => {
    if (state.moveNo === lastMoveNo.current) return;
    lastMoveNo.current = state.moveNo;
    setFlashAt(performance.now());
  }, [state.moveNo]);

  return (
    <div className="relative w-full flex-1 overflow-hidden bg-gradient-to-b from-sky-300 to-emerald-700" style={{ minHeight: "calc(100dvh - 3.5rem - env(safe-area-inset-top))" }}>
      <div ref={surface} className="absolute inset-0 touch-none select-none">
        <Scene
          state={state}
          selected={selected}
          targets={targets}
          movable={movable}
          aimed={aimed}
          onAim={setAimed}
          onTap={tap}
          walk={walk}
          walkApi={walkApi}
          surface={surface}
          flashAt={flashAt}
        />
      </div>
      <Hud
        state={state}
        me={me}
        players={players}
        role={role}
        myTurn={myTurn}
        placing={placing}
        selected={selected}
        targets={targets}
        movable={movable}
        aimed={aimed}
        walk={walk}
        walkApi={walkApi}
        flashAt={flashAt}
        canvas={surface}
      />
      <p className="pointer-events-auto absolute bottom-0.5 right-2 z-10 hidden whitespace-nowrap text-[9px] text-white/50 sm:block">
        <a className="underline" href="https://sketchfab.com/3d-models/stylized-bengal-tiger-with-4-animations-d87e750f18aa416dbccdd5ca7b81f751" target="_blank" rel="noreferrer">
          Tiger
        </a>{" "}
        by Jungle Jim ·{" "}
        <a className="underline" href="https://sketchfab.com/3d-models/lupe-goat-b48b9fefedfc4ec2991935f99b89b5e3" target="_blank" rel="noreferrer">
          goat
        </a>{" "}
        by jackiebatteau ·{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}

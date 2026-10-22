"use client";

import { Focus, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useSyncExternalStore } from "react";
import type { GameBoardProps } from "../types";
import AaduPuliBoard from "../aadu-puli/Board";
import { AaduPuliHeader, CaptureTally, useAaduPuliControls } from "../aadu-puli/controls";
import type { AaduPuliAction, AaduPuliState } from "../aadu-puli/logic";
import type { ViewApi } from "./ViewRig";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-emerald-50/80">Growing the forest…</div>,
});

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl === null) {
    try {
      webgl = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
const noop = () => () => {};

const VIEW_BUTTONS: { label: string; icon: typeof Focus; run: (v: ViewApi) => void }[] = [
  { label: "Rotate left", icon: RotateCcw, run: (v) => v.rotate(-1) },
  { label: "Rotate right", icon: RotateCw, run: (v) => v.rotate(1) },
  { label: "Zoom in", icon: ZoomIn, run: (v) => v.zoom(1) },
  { label: "Zoom out", icon: ZoomOut, run: (v) => v.zoom(-1) },
  { label: "Reset view", icon: Focus, run: (v) => v.reset() },
];

export default function AaduPuli3dBoard(props: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  // null on the server, then whether this device can draw 3D.
  const canDraw3d = useSyncExternalStore(noop, hasWebGL, () => null);
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 sm:p-3">
          <span className="hidden rounded-full bg-black/35 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-sm sm:inline">Drag to rotate · scroll or pinch to zoom</span>
          <div className="pointer-events-auto ml-auto flex gap-1 rounded-full bg-black/35 p-1 backdrop-blur-sm">
            {VIEW_BUTTONS.map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                onClick={() => view.current && run(view.current)}
                aria-label={label}
                title={label}
                className="grid size-9 place-items-center rounded-full text-white transition hover:bg-white/20 active:scale-90"
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
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

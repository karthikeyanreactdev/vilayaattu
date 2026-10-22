"use client";

import { Focus, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useSyncExternalStore, type RefObject } from "react";
import type { ViewApi } from "./ViewRig";

const VIEW_BUTTONS: { label: string; icon: typeof Focus; run: (v: ViewApi) => void }[] = [
  { label: "Rotate left", icon: RotateCcw, run: (v) => v.rotate(-1) },
  { label: "Rotate right", icon: RotateCw, run: (v) => v.rotate(1) },
  { label: "Zoom in", icon: ZoomIn, run: (v) => v.zoom(1) },
  { label: "Zoom out", icon: ZoomOut, run: (v) => v.zoom(-1) },
  { label: "Reset view", icon: Focus, run: (v) => v.reset() },
];

/** Rotate, zoom and reset buttons laid over a 3D canvas. */
export function ViewButtons({ view }: { view: RefObject<ViewApi | null> }) {
  return (
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
  );
}

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

/** null on the server, then whether this device can draw 3D. */
export function useCanDraw3d() {
  return useSyncExternalStore(noop, hasWebGL, () => null);
}

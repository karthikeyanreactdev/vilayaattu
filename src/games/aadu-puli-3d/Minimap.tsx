"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AaduPuliState } from "../aadu-puli/logic";
import { POINTS_3D, SEGMENTS_3D } from "./layout";
import type { WalkStore } from "./walk";

/** World units from the centre to the rim of the radar; the whole board fits from anywhere in the clearing. */
const RANGE = 23;
/** How long the latest move keeps flashing, in seconds. */
export const FLASH = 9;

/**
 * GTA-style radar: centred on you, turned so "up" is where you look. Tigers are
 * orange dots, goats white, the last move flashes gold, your view cone is the wedge.
 */
export function Minimap({
  walk,
  state,
  targets,
  movable,
  selected,
  flashAt,
  className,
}: {
  walk: WalkStore;
  state: AaduPuliState;
  targets: Map<number, boolean>;
  movable: Set<number>;
  selected: number | null;
  /** Timestamp (performance.now) of the last move, for the flash. */
  flashAt: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [big, setBig] = useState(false);
  const data = useRef({ state, targets, movable, selected, flashAt });
  useLayoutEffect(() => {
    data.current = { state, targets, movable, selected, flashAt };
  }, [state, targets, movable, selected, flashAt]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key.toLowerCase() === "m") setBig((b) => !b);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { state, targets, movable, selected, flashAt } = data.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = c.clientWidth;
      if (c.width !== px * dpr) {
        c.width = px * dpr;
        c.height = px * dpr;
      }
      const R = px / 2;
      const k = (R - 6) / RANGE;
      const p = walk.pose;
      const t = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, px, px);

      // Dial
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 24, 14, 0.78)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 3, 0, Math.PI * 2);
      ctx.clip();

      // World → radar: translate to you, rotate so your heading points up.
      ctx.translate(R, R);
      ctx.rotate(p.yaw);
      const W = (x: number, z: number): [number, number] => [(x - p.x) * k, (z - p.z) * k];

      // View cone
      ctx.save();
      ctx.rotate(-p.yaw);
      const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      cone.addColorStop(0, "rgba(255,255,255,0.22)");
      cone.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Board lines and points
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 230, 180, 0.45)";
      ctx.lineCap = "round";
      for (const [[ax, az], [bx, bz]] of SEGMENTS_3D) {
        ctx.beginPath();
        ctx.moveTo(...W(ax, az));
        ctx.lineTo(...W(bx, bz));
        ctx.stroke();
      }
      POINTS_3D.forEach(([x, z], i) => {
        const [sx, sz] = W(x, z);
        ctx.beginPath();
        ctx.arc(sx, sz, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 230, 180, 0.55)";
        ctx.fill();
        if (targets.has(i)) {
          ctx.beginPath();
          ctx.arc(sx, sz, 3.5 + Math.sin(t / 150) * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = targets.get(i) ? "#ef4444" : "#facc15";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Latest move: a gold trail from → to and a ping on the landing point.
      const lm = state.lastMove;
      const age = (t - flashAt) / 1000;
      if (lm && age < FLASH) {
        const a = 1 - age / FLASH;
        const [tx, tz] = W(...POINTS_3D[lm.to]);
        if (lm.from !== null) {
          const [fx, fz] = W(...POINTS_3D[lm.from]);
          ctx.beginPath();
          ctx.moveTo(fx, fz);
          ctx.lineTo(tx, tz);
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.9 * a})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        const ring = ((t / 900) % 1) * 12;
        ctx.beginPath();
        ctx.arc(tx, tz, 4 + ring, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(250, 204, 21, ${(1 - ring / 12) * a})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (lm.captured !== null) {
          const [cx, cz] = W(...POINTS_3D[lm.captured]);
          ctx.strokeStyle = `rgba(239, 68, 68, ${a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - 4, cz - 4);
          ctx.lineTo(cx + 4, cz + 4);
          ctx.moveTo(cx + 4, cz - 4);
          ctx.lineTo(cx - 4, cz + 4);
          ctx.stroke();
        }
      }

      // Animals
      state.board.forEach((c, i) => {
        if (!c) return;
        const [sx, sz] = W(...POINTS_3D[i]);
        const r = c === "T" ? 5 : 3.8;
        ctx.beginPath();
        ctx.arc(sx, sz, r, 0, Math.PI * 2);
        ctx.fillStyle = c === "T" ? "#fb923c" : "#f5f5f4";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = c === "T" ? "#7c2d12" : "#57534e";
        ctx.stroke();
        if (selected === i || movable.has(i)) {
          ctx.beginPath();
          ctx.arc(sx, sz, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = selected === i ? "#facc15" : "rgba(253, 230, 138, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Apex marker so you always know which way the point of the board is.
      const [ax, az] = W(...POINTS_3D[0]);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(ax, az - 9);
      ctx.rotate(-p.yaw);
      ctx.fillText("▲ apex", 0, 0);
      ctx.restore();

      ctx.restore();

      // You, always in the middle pointing up.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(R, R);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#082f49";
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [walk]);

  return (
    <button
      type="button"
      onClick={() => setBig((b) => !b)}
      aria-label={big ? "Shrink map" : "Enlarge map"}
      title="Tap to resize · M"
      className={cn("pointer-events-auto block rounded-full shadow-lg ring-2 ring-black/40 transition-[width,height] duration-200", big ? "size-64 sm:size-80" : "size-28 sm:size-36", className)}
    >
      <canvas ref={canvas} className="size-full rounded-full" />
    </button>
  );
}

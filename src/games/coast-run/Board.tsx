"use client";

import { useEffect, useRef, useState } from "react";
import { currentRunner } from "../arcade/runs";
import type { GameBoardProps } from "../types";
import { drawCoast } from "./draw";
import type { CoastAction, CoastState } from "./logic";
import { buildTrack, createDrive, formatMark, markFor, MAX_SPEED, RACE_LIMIT, stepDrive, type DriveInput } from "./sim";

const EMPTY: DriveInput = { left: false, right: false, accel: false, brake: false };

function Hold({ label, on }: { label: string; on: (down: boolean) => void }) {
  return (
    <button
      type="button"
      className="h-14 rounded-2xl border border-slate-700 bg-slate-900 text-sm font-bold text-white select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        on(true);
      }}
      onPointerUp={() => on(false)}
      onPointerCancel={() => on(false)}
      onLostPointerCapture={() => on(false)}
    >
      {label}
    </button>
  );
}

/** One coast, one clock, one driver at a time. */
export default function CoastBoard({ state, me, players, send, clockOffset }: GameBoardProps<CoastState, CoastAction>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<DriveInput>({ ...EMPTY });
  const sent = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;
  const [armed, setArmed] = useState(false);
  const [hud, setHud] = useState({ speed: 0, time: 0, done: false });
  const runner = currentRunner(state);
  const mine = runner?.id === me && state.status === "playing";
  const track = useRef(buildTrack(state.seed));

  useEffect(() => {
    track.current = buildTrack(state.seed);
  }, [state.seed]);

  useEffect(() => {
    sent.current = false;
    setArmed(false);
  }, [state.turn, state.moveNo]);

  useEffect(() => {
    if (!mine || !armed) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
      if (k === "arrowleft" || k === "a") input.current.left = true;
      if (k === "arrowright" || k === "d") input.current.right = true;
      if (k === "arrowup" || k === "w") input.current.accel = true;
      if (k === "arrowdown" || k === "s") input.current.brake = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") input.current.left = false;
      if (k === "arrowright" || k === "d") input.current.right = false;
      if (k === "arrowup" || k === "w") input.current.accel = false;
      if (k === "arrowdown" || k === "s") input.current.brake = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      input.current = { ...EMPTY };
    };
  }, [mine, armed]);

  useEffect(() => {
    if (!mine || !armed) return;
    const c = canvas.current;
    if (!c) return;
    const drive = createDrive();
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const live = drive.time < RACE_LIMIT && !drive.done;
      if (live) stepDrive(drive, input.current, dt, track.current);
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.max(1, Math.round(rect.width * dpr));
      const ph = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
      const lean = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      drawCoast(ctx, pw, ph, drive, track.current, lean);
      if (now % 120 < 20) setHud({ speed: drive.speed / MAX_SPEED, time: drive.time, done: drive.done });
      if ((drive.done || drive.time >= RACE_LIMIT) && !sent.current) {
        sent.current = true;
        sendRef.current({ type: "finish", mark: markFor(drive, track.current) });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mine, armed]);

  const left = Math.max(0, Math.ceil((state.deadline - (Date.now() + clockOffset)) / 1000));
  const name = runner ? players.find((p) => p.id === runner.id)?.name ?? "Driver" : "";
  const kmh = Math.round(hud.speed * 220);

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold">{mine ? "Your run" : `${name} is driving`}</p>
        <p className="text-muted-foreground tabular-nums">{state.status === "playing" ? `${left}s` : "Done"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        {state.players.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-border bg-card px-2 py-1.5">
            <p className="truncate font-medium">{p.name}</p>
            <p className="tabular-nums text-muted-foreground">
              {state.marks[i] == null ? (i === state.turn ? "on track" : "—") : formatMark(state.marks[i]!)}
            </p>
          </div>
        ))}
      </div>
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-slate-950">
        <canvas ref={canvas} className="aspect-[16/10] w-full" />
        {mine && !armed && (
          <button type="button" className="absolute inset-0 grid place-items-center bg-slate-950/75 text-white" onClick={() => setArmed(true)}>
            <span className="rounded-full bg-primary px-5 py-3 text-base font-bold text-primary-foreground">Start engine</span>
          </button>
        )}
        {!mine && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/50 text-sm font-medium text-white">
            {state.status === "playing" ? "Waiting for this run" : "Race complete"}
          </div>
        )}
      </div>
      {mine && armed && (
        <>
          <p className="text-center text-sm tabular-nums text-muted-foreground">
            {kmh} km/h · {hud.time.toFixed(1)}s {hud.done ? "· finish" : ""}
          </p>
          <div className="grid grid-cols-4 gap-2">
            <Hold label="Left" on={(d) => (input.current.left = d)} />
            <Hold label="Right" on={(d) => (input.current.right = d)} />
            <Hold label="Gas" on={(d) => (input.current.accel = d)} />
            <Hold label="Brake" on={(d) => (input.current.brake = d)} />
          </div>
          <p className="text-center text-xs text-muted-foreground">Arrows or A/D to steer, W for gas, S to brake. Stay off the grass.</p>
        </>
      )}
    </div>
  );
}

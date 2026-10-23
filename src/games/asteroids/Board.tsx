"use client";

import { useEffect, useRef, useState } from "react";
import { currentRunner } from "../arcade/runs";
import type { GameBoardProps } from "../types";
import type { AsteroidsAction, AsteroidsState } from "./logic";
import { createField, FIELD_H, FIELD_W, MATCH_SECONDS, rockShape, stepField, type Field, type Input } from "./sim";

const EMPTY: Input = { left: false, right: false, thrust: false, fire: false };

function paint(ctx: CanvasRenderingContext2D, field: Field, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#070b16");
  g.addColorStop(1, "#14182b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 48; i++) {
    const x = ((i * 97) % FIELD_W) * (w / FIELD_W);
    const y = ((i * 53) % FIELD_H) * (h / FIELD_H);
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
  const sx = w / FIELD_W;
  const sy = h / FIELD_H;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = "#d7e3ff";
  ctx.lineWidth = 2;
  const strokeRock = (r: Field["rocks"][number], ox: number, oy: number) => {
    const pts = rockShape(r);
    ctx.beginPath();
    ctx.moveTo(r.x + ox + pts[0][0], r.y + oy + pts[0][1]);
    for (const [px, py] of pts) ctx.lineTo(r.x + ox + px, r.y + oy + py);
    ctx.closePath();
    ctx.stroke();
  };
  for (const r of field.rocks) {
    strokeRock(r, 0, 0);
    const left = r.x < r.r;
    const right = r.x > FIELD_W - r.r;
    const top = r.y < r.r;
    const bottom = r.y > FIELD_H - r.r;
    if (left) strokeRock(r, FIELD_W, 0);
    if (right) strokeRock(r, -FIELD_W, 0);
    if (top) strokeRock(r, 0, FIELD_H);
    if (bottom) strokeRock(r, 0, -FIELD_H);
    if (left && top) strokeRock(r, FIELD_W, FIELD_H);
    if (right && top) strokeRock(r, -FIELD_W, FIELD_H);
    if (left && bottom) strokeRock(r, FIELD_W, -FIELD_H);
    if (right && bottom) strokeRock(r, -FIELD_W, -FIELD_H);
  }
  ctx.fillStyle = "#f4f7ff";
  for (const s of field.shots) ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
  const p = field.pilot;
  if (p.alive && (p.inv <= 0 || Math.floor(field.time * 12) % 2 === 0)) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, 9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -9);
    ctx.closePath();
    ctx.fillStyle = "#7dd3fc";
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function Hold({
  label,
  on,
}: {
  label: string;
  on: (down: boolean) => void;
}) {
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

/** Live asteroid run for the seat whose turn it is. Everyone else watches the score. */
export default function AsteroidsBoard({ state, me, players, send, clockOffset }: GameBoardProps<AsteroidsState, AsteroidsAction>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<Field | null>(null);
  const input = useRef<Input>({ ...EMPTY });
  const sent = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;
  const [armed, setArmed] = useState(false);
  const [hud, setHud] = useState({ score: 0, lives: 3, time: MATCH_SECONDS });
  const runner = currentRunner(state);
  const mine = runner?.id === me && state.status === "playing";

  useEffect(() => {
    sent.current = false;
    field.current = null;
    setArmed(false);
  }, [state.turn, state.moveNo]);

  useEffect(() => {
    if (!mine || !armed) return;
    const down = (e: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "arrowup", " "].includes(e.key.toLowerCase())) e.preventDefault();
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") input.current.left = true;
      if (k === "arrowright" || k === "d") input.current.right = true;
      if (k === "arrowup" || k === "w") input.current.thrust = true;
      if (k === " ") input.current.fire = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") input.current.left = false;
      if (k === "arrowright" || k === "d") input.current.right = false;
      if (k === "arrowup" || k === "w") input.current.thrust = false;
      if (k === " ") input.current.fire = false;
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
    field.current = createField((state.seed + state.turn * 997) ^ (Date.now() & 0xfffffff));
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const f = field.current;
      const ctx = c.getContext("2d");
      if (!f || !ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepField(f, input.current, dt);
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.max(1, Math.round(rect.width * dpr));
      const ph = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }
      paint(ctx, f, pw, ph);
      if (now % 100 < 20) setHud({ score: f.score, lives: f.pilot.lives, time: Math.max(0, MATCH_SECONDS - f.time) });
      if (f.over && !sent.current) {
        sent.current = true;
        sendRef.current({ type: "finish", score: f.score });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mine, armed, state.seed, state.turn]);

  const left = Math.max(0, Math.ceil((state.deadline - (Date.now() + clockOffset)) / 1000));
  const name = runner ? players.find((p) => p.id === runner.id)?.name ?? "Pilot" : "";

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold">{mine ? "Your run" : `${name} is flying`}</p>
        <p className="text-muted-foreground tabular-nums">{state.status === "playing" ? `${left}s` : "Done"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        {state.players.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-border bg-card px-2 py-1.5">
            <p className="truncate font-medium">{p.name}</p>
            <p className="tabular-nums text-muted-foreground">{state.marks[i] == null ? (i === state.turn ? "flying" : "—") : state.marks[i]}</p>
          </div>
        ))}
      </div>
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-slate-950">
        <canvas ref={canvas} className="aspect-[8/5] w-full" />
        {mine && !armed && (
          <button
            type="button"
            className="absolute inset-0 grid place-items-center bg-slate-950/80 text-white"
            onClick={() => setArmed(true)}
          >
            <span className="rounded-full bg-primary px-5 py-3 text-base font-bold text-primary-foreground">Start flying</span>
          </button>
        )}
        {!mine && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-sm font-medium text-white">
            {state.status === "playing" ? "Watching this run" : "Run complete"}
          </div>
        )}
      </div>
      {mine && armed && (
        <>
          <p className="text-center text-sm tabular-nums text-muted-foreground">
            {hud.score} pts · {hud.lives} ships · {hud.time.toFixed(0)}s
          </p>
          <div className="grid grid-cols-4 gap-2">
            <Hold label="Left" on={(d) => (input.current.left = d)} />
            <Hold label="Right" on={(d) => (input.current.right = d)} />
            <Hold label="Thrust" on={(d) => (input.current.thrust = d)} />
            <Hold label="Fire" on={(d) => (input.current.fire = d)} />
          </div>
          <p className="text-center text-xs text-muted-foreground">Arrows or A/D to turn, W to thrust, space to fire.</p>
        </>
      )}
    </div>
  );
}

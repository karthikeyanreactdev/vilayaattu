"use client";

import { useEffect, useRef, useState } from "react";
import type { BotLevel, PlayerRef } from "../types";
import type { GameBoardProps } from "../types";
import { CAR_COLORS, drawCoast, type CoastSprite } from "./draw";
import type { CoastAction, CoastState } from "./logic";
import { botInput, buildTrack, createDrive, formatMark, markFor, MAX_SPEED, RACE_LIMIT, stepDrive, type Drive, type DriveInput } from "./sim";

const EMPTY: DriveInput = { left: false, right: false, accel: false, brake: false };

function levelOf(player: PlayerRef): BotLevel | null {
  const bot = (player as PlayerRef & { bot?: BotLevel }).bot;
  return bot === "beginner" || bot === "intermediate" || bot === "pro" ? bot : null;
}

function Hold({ label, on }: { label: string; on: (down: boolean) => void }) {
  return (
    <button
      type="button"
      className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900 text-sm font-bold text-white select-none"
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

/** Everyone shares one coast. This phone draws every car into the same frame. */
export default function CoastBoard({ state, me, players, send, clockOffset }: GameBoardProps<CoastState, CoastAction>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<DriveInput>({ ...EMPTY });
  const sent = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;
  const track = useRef(buildTrack(state.seed));
  const spotsRef = useRef(state.spots);
  spotsRef.current = state.spots;
  const playersRef = useRef(players);
  playersRef.current = players;
  const racersRef = useRef(state.players);
  racersRef.current = state.players;
  const clockRef = useRef(clockOffset);
  clockRef.current = clockOffset;
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const [hud, setHud] = useState({ speed: 0, time: 0, done: false, place: 1, lights: -1, progress: 0, race: 0 });
  const mine = state.players.findIndex((p) => p.id === me);
  const racing = mine >= 0 && state.status === "playing";

  useEffect(() => {
    track.current = buildTrack(state.seed);
  }, [state.seed]);

  useEffect(() => {
    if (!racing) return;
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
  }, [racing]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const drive = createDrive();
    const field = racersRef.current;
    const ghosts = field.map((p, i) => {
      const level = levelOf(playersRef.current.find((q) => q.id === p.id) ?? p);
      if (!level || i === mine) return null;
      const ghost = createDrive();
      ghost.x = (i - (field.length - 1) / 2) * 0.55;
      return { level, drive: ghost, simmed: 0 };
    });
    let lastSpot = 0;
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const raceT = (Date.now() + clockRef.current - state.startAt) / 1000;
      const green = raceT >= 0 && statusRef.current === "playing";
      const driving = mine >= 0 && statusRef.current === "playing";
      if (green && driving && !drive.done && drive.time < RACE_LIMIT) stepDrive(drive, input.current, dt, track.current);
      if (green) {
        const target = Math.min(RACE_LIMIT, raceT);
        for (const ghost of ghosts) {
          if (!ghost || ghost.drive.done) continue;
          for (let n = 0; n < 30 && ghost.simmed < target; n++) {
            const step = Math.min(1 / 60, target - ghost.simmed);
            stepDrive(ghost.drive, botInput(ghost.level, ghost.drive, track.current), step, track.current);
            ghost.simmed += step;
          }
        }
      }
      const rect = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.max(1, Math.round(rect.width * dpr));
      const ph = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== pw || c.height !== ph) {
        c.width = pw;
        c.height = ph;
      }

      const spots = spotsRef.current;
      const racers = racersRef.current;
      const cars: CoastSprite[] = [];
      racers.forEach((p, i) => {
        if (i === mine) return;
        const ghost = ghosts[i];
        const spot = spots[i];
        const color = CAR_COLORS[i % CAR_COLORS.length];
        const name = p.name.split(" ")[0] ?? p.name;
        if (ghost) {
          const lane = i - (racers.length - 1) / 2;
          const x = Math.max(-0.85, Math.min(0.85, ghost.drive.x + lane * 0.22));
          cars.push({ x, z: ghost.drive.position, color, name });
          return;
        }
        if (!spot) return;
        cars.push({ x: spot.x, z: Math.max(spot.z, raceT < 0 ? 0 : spot.z), color, name });
      });

      const camera: Drive = mine >= 0
        ? drive
        : {
            position: Math.max(0, ...spots.map((s) => s.z), ...ghosts.map((g) => g?.drive.position ?? 0)),
            speed: 0,
            x: 0,
            time: Math.max(0, raceT),
            done: false,
          };
      const lean = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      const meColor = mine >= 0 ? CAR_COLORS[mine % CAR_COLORS.length] : CAR_COLORS[0];
      drawCoast(ctx, pw, ph, camera, track.current, mine >= 0 ? lean : 0, cars, mine >= 0 ? { color: meColor, name: "" } : null);

      if (raceT < 0 && raceT > -8) {
        ctx.fillStyle = "rgba(2, 6, 23, 0.28)";
        ctx.fillRect(0, 0, pw, ph);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${Math.round(ph * 0.16)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillText(String(Math.max(1, Math.ceil(-raceT))), pw / 2, ph / 2);
      }

      const zs = racers.map((_, i) => (i === mine ? drive.position : ghosts[i]?.drive.position ?? spots[i]?.z ?? 0));
      const place = 1 + zs.filter((z, i) => i !== mine && z > (mine >= 0 ? drive.position : -1)).length;
      if (now % 120 < 20) {
        setHud({
          speed: drive.speed / MAX_SPEED,
          time: Math.max(0, mine >= 0 ? drive.time : raceT),
          race: Math.max(0, raceT),
          done: drive.done,
          place: mine >= 0 ? place : 0,
          lights: raceT,
          progress: track.current.finishZ > 0 ? Math.min(1, (mine >= 0 ? drive.position : camera.position) / track.current.finishZ) : 0,
        });
      }

      if (driving && green && now - lastSpot > 250) {
        lastSpot = now;
        sendRef.current({ type: "spot", z: drive.position, x: drive.x, speed: drive.speed, done: drive.done });
      }
      if (driving && (drive.done || drive.time >= RACE_LIMIT) && !sent.current) {
        sent.current = true;
        sendRef.current({ type: "finish", mark: markFor(drive, track.current) });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mine, state.seed, state.startAt]);

  const kmh = Math.round(hud.speed * 220);
  const progress = hud.progress;

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">{state.status !== "playing" ? "Finished" : hud.lights < 0 ? "Lights" : `P${hud.place}`}</p>
        <p className="tabular-nums text-muted-foreground">{hud.time.toFixed(1)}s · {kmh} km/h {hud.done ? "· finish" : ""}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {state.players.map((p, i) => {
          const spot = state.spots[i];
          const color = CAR_COLORS[i % CAR_COLORS.length];
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
              <span className="size-3 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {spot?.mark != null && (state.status !== "playing" || (spot.mark < 200_000 && hud.race >= spot.mark / 1000))
                    ? formatMark(spot.mark)
                    : i === mine
                      ? "you"
                      : "on road"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-slate-950">
        <canvas ref={canvas} className="aspect-[16/10] w-full" />
        <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-orange-400" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {racing && (
        <>
          <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
            <Hold label="Left" on={(d) => (input.current.left = d)} />
            <Hold label="Right" on={(d) => (input.current.right = d)} />
            <Hold label="Gas" on={(d) => (input.current.accel = d)} />
            <Hold label="Brake" on={(d) => (input.current.brake = d)} />
          </div>
          <p className="text-center text-xs text-muted-foreground">Arrows or A/D steer, W is gas, S brakes. Every other car is on this road.</p>
        </>
      )}
    </div>
  );
}

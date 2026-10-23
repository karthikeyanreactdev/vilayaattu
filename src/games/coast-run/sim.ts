import { mulberry32 } from "../arcade/rng";
import type { BotLevel } from "../types";

/**
 * Pseudo-3D road. The camera looks down a ribbon of segments; curves and
 * hills are original. Nothing here is from a commercial racer.
 */

export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 2000;
export const CAMERA_HEIGHT = 1000;
export const DRAW_DISTANCE = 200;
export const FIELD_OF_VIEW = 100;
export const CAMERA_DEPTH = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180);
export const MAX_SPEED = SEGMENT_LENGTH / (1 / 60);
export const RACE_LIMIT = 90;

export type Segment = {
  index: number;
  curve: number;
  y1: number;
  y2: number;
};

export type Drive = {
  position: number;
  speed: number;
  x: number;
  time: number;
  done: boolean;
};

export type DriveInput = { left: boolean; right: boolean; accel: boolean; brake: boolean };

export type Track = { segments: Segment[]; finish: number; finishZ: number };

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function addSection(segments: Segment[], n: number, curve: number, hill: number) {
  const y0 = segments.length ? segments[segments.length - 1].y2 : 0;
  const enter = Math.max(1, Math.floor(n * 0.25));
  const leave = Math.max(1, Math.floor(n * 0.25));
  for (let i = 0; i < n; i++) {
    let c = curve;
    if (i < enter) c = curve * ease(i / enter);
    else if (i > n - leave) c = curve * ease((n - i) / leave);
    const y1 = segments.length ? segments[segments.length - 1].y2 : 0;
    const y2 = y0 + Math.sin(((i + 1) / n) * Math.PI) * hill;
    segments.push({ index: segments.length, curve: c, y1, y2 });
  }
}

/** Same seed, same coast, on every phone. */
export function buildTrack(seed: number): Track {
  const rng = mulberry32(seed || 1);
  const segments: Segment[] = [];
  addSection(segments, 50, 0, 0);
  const plan: [number, number, number][] = [
    [80, 1.6, 0],
    [70, 0, 7000],
    [110, -2.4, 0],
    [60, 0, -5000],
    [90, 3.2, 3500],
    [70, -1.4, 0],
    [80, 0, 9000],
    [100, 2, -2000],
    [90, -3.4, 0],
    [60, 0, 0],
  ];
  for (const [n, c, h] of plan) addSection(segments, n, c, h);
  while (segments.length < 1400) {
    const hard = rng.next() < 0.35;
    const curve = (rng.next() * 2 - 1) * (hard ? 3.6 : 1.8);
    const hill = (rng.next() * 2 - 1) * (rng.next() < 0.5 ? 8000 : 0);
    addSection(segments, 36 + Math.floor(rng.next() * 40), Math.abs(curve) < 0.4 ? 0 : curve, hill);
  }
  const finish = segments.length;
  addSection(segments, 40, 0, 0);
  addSection(segments, 180, 0, 0);
  return { segments, finish, finishZ: finish * SEGMENT_LENGTH };
}

export function createDrive(): Drive {
  return { position: 0, speed: 0, x: 0, time: 0, done: false };
}

export function stepDrive(drive: Drive, input: DriveInput, dt: number, track: Track) {
  if (drive.done || drive.time >= RACE_LIMIT) return;
  dt = Math.min(0.05, Math.max(0, dt));
  const index = Math.floor(drive.position / SEGMENT_LENGTH) % track.segments.length;
  const seg = track.segments[index];
  const off = Math.abs(drive.x) > 1;
  const cap = off ? MAX_SPEED / 4 : MAX_SPEED;
  if (input.accel) drive.speed += (MAX_SPEED / 5) * dt;
  else drive.speed -= (MAX_SPEED / 8) * dt;
  if (input.brake) drive.speed -= MAX_SPEED * dt;
  if (off && drive.speed > cap) drive.speed -= (MAX_SPEED / 2) * dt;
  drive.speed = Math.max(0, Math.min(drive.speed, cap));

  const speedPercent = drive.speed / MAX_SPEED;
  const dx = dt * 2 * speedPercent;
  drive.x -= dx * speedPercent * seg.curve * 0.3;
  if (input.left) drive.x -= dx;
  if (input.right) drive.x += dx;
  drive.x = Math.max(-2, Math.min(2, drive.x));

  drive.position += dt * drive.speed;
  drive.time += dt;
  if (drive.position >= track.finishZ) {
    drive.position = track.finishZ;
    drive.speed = 0;
    drive.done = true;
  }
}

/** Lower is better. A finish is the clock. A DNF encodes how far you got. */
export function markFor(drive: Drive, track: Track): number {
  if (drive.done) return Math.max(1, Math.round(drive.time * 1000));
  const progress = Math.max(0, Math.min(1, drive.position / track.finishZ));
  return 200_000 + Math.round((1 - progress) * 100_000);
}

export function formatMark(mark: number): string {
  if (mark >= 200_000) return "DNF";
  const total = mark / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/** The computer drives the same road. Skill is how far ahead it looks. */
export function autoTime(level: BotLevel, seed: number): number {
  const track = buildTrack(seed);
  const drive = createDrive();
  const look = level === "pro" ? 22 : level === "intermediate" ? 14 : 8;
  const gain = level === "pro" ? 2.8 : level === "intermediate" ? 2 : 1.15;
  const dt = 1 / 60;
  while (drive.time < RACE_LIMIT && !drive.done) {
    const i = Math.floor(drive.position / SEGMENT_LENGTH);
    let curve = 0;
    for (let k = 2; k <= look; k++) curve += track.segments[(i + k) % track.segments.length].curve;
    curve /= look;
    // A positive curve pulls the car left, so the target sits a little right of centre.
    const target = Math.max(-0.72, Math.min(0.72, curve * 0.28));
    const err = target - drive.x;
    const steer = Math.max(-1, Math.min(1, err * gain));
    const off = Math.abs(drive.x) > 0.92;
    const fast = Math.abs(curve) > 2.6 && drive.speed > MAX_SPEED * 0.78;
    stepDrive(
      drive,
      {
        left: steer < -0.12,
        right: steer > 0.12,
        accel: !off && !fast && drive.speed < MAX_SPEED * (level === "beginner" ? 0.7 : 0.96),
        brake: off || fast,
      },
      dt,
      track,
    );
  }
  return markFor(drive, track);
}

export type Proj = { x: number; y: number; w: number; z: number };

export function project(
  worldX: number,
  worldY: number,
  worldZ: number,
  camX: number,
  camY: number,
  camZ: number,
  width: number,
  height: number,
): Proj | null {
  const z = worldZ - camZ;
  if (z <= CAMERA_DEPTH) return null;
  const scale = CAMERA_DEPTH / z;
  return {
    z,
    x: width / 2 + scale * (worldX - camX) * (width / 2),
    y: height / 2 - scale * (worldY - camY) * (height / 2),
    w: scale * ROAD_WIDTH * (width / 2),
  };
}

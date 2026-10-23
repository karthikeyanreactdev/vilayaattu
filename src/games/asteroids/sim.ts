import { mulberry32, type Rng } from "../arcade/rng";
import type { BotLevel } from "../types";

/** Original asteroid field. Wrap-around space, three rock sizes, no borrowed art. */

export const FIELD_W = 800;
export const FIELD_H = 500;
export const MATCH_SECONDS = 60;
const SCORES = [20, 50, 100] as const;
const RADII = [46, 26, 14] as const;

export type Input = { left: boolean; right: boolean; thrust: boolean; fire: boolean };

export type Rock = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  vr: number;
  tier: 0 | 1 | 2;
  jag: number;
};

export type Shot = { x: number; y: number; vx: number; vy: number; life: number };

export type Pilot = {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  cool: number;
  inv: number;
  lives: number;
  alive: boolean;
};

export type Field = {
  pilot: Pilot;
  rocks: Rock[];
  shots: Shot[];
  score: number;
  time: number;
  over: boolean;
  wave: number;
  rng: Rng;
};

const wrap = (v: number, max: number) => ((v % max) + max) % max;

function dist(x1: number, y1: number, x2: number, y2: number) {
  let dx = Math.abs(x1 - x2);
  let dy = Math.abs(y1 - y2);
  if (dx > FIELD_W / 2) dx = FIELD_W - dx;
  if (dy > FIELD_H / 2) dy = FIELD_H - dy;
  return Math.hypot(dx, dy);
}

function rock(rng: Rng, x: number, y: number, vx: number, vy: number, tier: 0 | 1 | 2): Rock {
  return {
    x,
    y,
    vx,
    vy,
    r: RADII[tier],
    spin: rng.next() * Math.PI * 2,
    vr: (rng.next() - 0.5) * 1.6,
    tier,
    jag: rng.next(),
  };
}

function spawn(rng: Rng, count: number, sx: number, sy: number): Rock[] {
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    let x = rng.next() * FIELD_W;
    let y = rng.next() * FIELD_H;
    for (let k = 0; k < 6 && dist(x, y, sx, sy) < 160; k++) {
      x = rng.next() * FIELD_W;
      y = rng.next() * FIELD_H;
    }
    const ang = rng.next() * Math.PI * 2;
    const sp = 18 + rng.next() * 36;
    rocks.push(rock(rng, x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, 0));
  }
  return rocks;
}

export function createField(seed: number): Field {
  const rng = mulberry32(seed || 1);
  return {
    pilot: { x: FIELD_W / 2, y: FIELD_H / 2, a: -Math.PI / 2, vx: 0, vy: 0, cool: 0, inv: 1.6, lives: 3, alive: true },
    rocks: spawn(rng, 4, FIELD_W / 2, FIELD_H / 2),
    shots: [],
    score: 0,
    time: 0,
    over: false,
    wave: 1,
    rng,
  };
}

/** Outline of a rock, in local coordinates. */
export function rockShape(r: Rock): [number, number][] {
  const pts: [number, number][] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = r.spin + (i / n) * Math.PI * 2;
    const wobble = 0.72 + 0.28 * Math.abs(Math.sin(i * 1.7 + r.jag * 6));
    pts.push([Math.cos(a) * r.r * wobble, Math.sin(a) * r.r * wobble]);
  }
  return pts;
}

export function stepField(field: Field, input: Input, dt: number) {
  if (field.over) return;
  dt = Math.min(0.05, Math.max(0, dt));
  field.time += dt;
  if (field.time >= MATCH_SECONDS) {
    field.over = true;
    return;
  }
  const p = field.pilot;
  if (!p.alive) return;

  if (input.left) p.a -= 3.3 * dt;
  if (input.right) p.a += 3.3 * dt;
  if (input.thrust) {
    p.vx += Math.cos(p.a) * 230 * dt;
    p.vy += Math.sin(p.a) * 230 * dt;
  }
  p.vx *= Math.exp(-0.45 * dt);
  p.vy *= Math.exp(-0.45 * dt);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 280) {
    p.vx = (p.vx / sp) * 280;
    p.vy = (p.vy / sp) * 280;
  }
  p.x = wrap(p.x + p.vx * dt, FIELD_W);
  p.y = wrap(p.y + p.vy * dt, FIELD_H);
  p.cool = Math.max(0, p.cool - dt);
  p.inv = Math.max(0, p.inv - dt);

  if (input.fire && p.cool <= 0 && field.shots.length < 4) {
    p.cool = 0.22;
    field.shots.push({
      x: p.x + Math.cos(p.a) * 18,
      y: p.y + Math.sin(p.a) * 18,
      vx: p.vx + Math.cos(p.a) * 440,
      vy: p.vy + Math.sin(p.a) * 440,
      life: 0.72,
    });
  }

  for (const s of field.shots) {
    s.x = wrap(s.x + s.vx * dt, FIELD_W);
    s.y = wrap(s.y + s.vy * dt, FIELD_H);
    s.life -= dt;
  }

  for (const r of field.rocks) {
    r.x = wrap(r.x + r.vx * dt, FIELD_W);
    r.y = wrap(r.y + r.vy * dt, FIELD_H);
    r.spin += r.vr * dt;
  }

  const born: Rock[] = [];
  const broken = new Set<number>();
  field.shots = field.shots.filter((s) => {
    if (s.life <= 0) return false;
    for (let i = 0; i < field.rocks.length; i++) {
      if (broken.has(i)) continue;
      const r = field.rocks[i];
      if (dist(s.x, s.y, r.x, r.y) >= r.r) continue;
      broken.add(i);
      field.score += SCORES[r.tier];
      if (r.tier < 2) {
        const base = Math.atan2(r.vy, r.vx);
        const spd = Math.hypot(r.vx, r.vy) + 30;
        for (const side of [-0.7, 0.7]) {
          born.push(
            rock(field.rng, r.x, r.y, Math.cos(base + side) * spd, Math.sin(base + side) * spd, (r.tier + 1) as 1 | 2),
          );
        }
      }
      return false;
    }
    return true;
  });
  if (broken.size) field.rocks = field.rocks.filter((_, i) => !broken.has(i)).concat(born);

  if (field.rocks.length === 0) {
    field.wave += 1;
    field.rocks = spawn(field.rng, Math.min(7, 3 + field.wave), p.x, p.y);
  }

  if (p.inv <= 0) {
    for (const r of field.rocks) {
      if (dist(p.x, p.y, r.x, r.y) >= r.r + 9) continue;
      p.lives -= 1;
      if (p.lives <= 0) {
        field.over = true;
        p.alive = false;
        return;
      }
      p.x = FIELD_W / 2;
      p.y = FIELD_H / 2;
      p.vx = 0;
      p.vy = 0;
      p.inv = 2;
      break;
    }
  }
}

function nearest(field: Field) {
  let best: Rock | null = null;
  let bestD = Infinity;
  for (const r of field.rocks) {
    const d = dist(field.pilot.x, field.pilot.y, r.x, r.y);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return { rock: best, d: bestD };
}

/** Fly a whole run. Higher skill turns and shoots more cleanly. */
export function autoScore(level: BotLevel, seed: number): number {
  const field = createField(seed);
  const aim = level === "pro" ? 0.18 : level === "intermediate" ? 0.32 : 0.55;
  const trigger = level === "pro" ? 0.9 : level === "intermediate" ? 0.65 : 0.35;
  const dt = 1 / 30;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  while (!field.over) {
    const p = field.pilot;
    const { rock: target, d } = nearest(field);
    let left = false;
    let right = false;
    let fire = false;
    if (target) {
      let want = Math.atan2(target.y - p.y, target.x - p.x);
      // Prefer the wrapped direction when the rock is across the edge.
      const altX = target.x + (target.x < p.x ? FIELD_W : -FIELD_W);
      const altY = target.y + (target.y < p.y ? FIELD_H : -FIELD_H);
      if (Math.hypot(altX - p.x, altY - p.y) < d) want = Math.atan2(altY - p.y, altX - p.x);
      let diff = Math.atan2(Math.sin(want - p.a), Math.cos(want - p.a));
      if (Math.abs(diff) > aim) {
        if (diff > 0) right = true;
        else left = true;
      }
      fire = Math.abs(diff) < aim && d < 320 && rng.next() < trigger;
    }
    const speed = Math.hypot(p.vx, p.vy);
    stepField(field, { left, right, thrust: speed < 90 && (d > 140 || !target), fire }, dt);
  }
  return field.score;
}

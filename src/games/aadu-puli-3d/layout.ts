import { SEGMENTS } from "../aadu-puli/board";

/** How much roomier the 3D board is than the first layout; points sit further apart so tigers have space. */
export const SPREAD = (4 / 3) * 1.3;

/** World units per SVG unit of the 2D board. */
const S = 0.12 * SPREAD;

/**
 * Same shape and point order as board.ts, but the 4-point row sits lower down the
 * triangle, where it is wider, so two tigers side by side don't touch.
 */
const ROW_Y = [0, 38, 58, 79, 100];
const BASE_X = [12, 38, 62, 88];
const EAR_X = [2, 98];
const fanX = (i: number, y: number) => 50 + (BASE_X[i] - 50) * (y / ROW_Y[4]);

/** The 23 board points on the ground plane (x, z), apex away from the camera. */
export const POINTS_3D: [number, number][] = (() => {
  const c: [number, number][] = [[50, ROW_Y[0]]];
  for (let i = 0; i < 4; i++) c.push([fanX(i, ROW_Y[1]), ROW_Y[1]]);
  for (let row = 2; row <= 4; row++) {
    const y = ROW_Y[row];
    c.push([EAR_X[0], y]);
    for (let i = 0; i < 4; i++) c.push([fanX(i, y), y]);
    c.push([EAR_X[1], y]);
  }
  return c.map(([x, y]) => [(x - 50) * S, (y - 52) * S]);
})();

export const SEGMENTS_3D = SEGMENTS.map(([a, b]) => [POINTS_3D[a], POINTS_3D[b]] as const);

/** Top of the stepping stones; pieces stand here. */
export const STONE_TOP = 0.09;

/** Clearing radii (x, z). */
export const CLEARING: [number, number] = [9.2 * SPREAD, 8.8 * SPREAD];

/** Small deterministic RNG so the forest looks the same for every player. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segDist(px: number, pz: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

/** True when (x, z) keeps clear of every path and stone. */
export function clearOfBoard(x: number, z: number, padLine: number, padPoint: number) {
  return SEGMENTS_3D.every(([a, b]) => segDist(x, z, a, b) > padLine) && POINTS_3D.every(([px, pz]) => Math.hypot(px - x, pz - z) > padPoint);
}

export function insideClearing(x: number, z: number, shrink = 0) {
  return (x / (CLEARING[0] - shrink)) ** 2 + (z / (CLEARING[1] - shrink)) ** 2 < 1;
}

/** Where captured goats sit: the empty corner right of the apex. */
export const PEN_SPOTS: [number, number][] = Array.from({ length: 15 }, (_, i) => [(2.8 + (i % 5) * 0.85) * SPREAD, (-1.1 - Math.floor(i / 5) * 1.0) * SPREAD]);

export function inPen(x: number, z: number, pad: number) {
  return x > 2.8 * SPREAD - pad && x < 6.2 * SPREAD + pad && z < -1.1 * SPREAD + pad && z > -3.1 * SPREAD - pad;
}

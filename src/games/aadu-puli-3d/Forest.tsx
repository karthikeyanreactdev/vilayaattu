"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLEARING, POINTS_3D, SEGMENTS_3D, SPREAD, clearOfBoard, inPen, insideClearing, rng } from "./layout";

const COLORS = {
  ground: "#476a2d",
  moss: "#5c8238",
  dirt: "#7d6449",
  stone: "#959089",
  bark: "#54412e",
  leaves: ["#306130", "#457638", "#59823f"],
  grass: "#6a9446",
  flowers: ["#f2c230", "#f3f1ea", "#c25b86"],
  rocks: ["#8d8a80", "#7d7f6e", "#6f7a5a"],
};

/** Moss clearing that fades into the forest floor with a ragged, natural edge. */
function clearingTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const unit = c / 1.3; // canvas px per clearing radius
  const rand = rng(99);
  const g = ctx.createRadialGradient(c, c, 0, c, c, unit * 1.2);
  g.addColorStop(0, "rgba(118,160,74,1)");
  g.addColorStop(0.75, "rgba(106,148,67,1)");
  g.addColorStop(0.85, "rgba(98,138,62,0.7)");
  g.addColorStop(1, "rgba(90,128,58,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Ragged rim and soft patches of lighter and darker moss.
  for (let i = 0; i < 420; i++) {
    const a = rand() * Math.PI * 2;
    const rim = i < 260;
    const d = rim ? unit * (0.82 + rand() * 0.28) : unit * Math.sqrt(rand()) * 0.85;
    const rad = rim ? 10 + rand() * 22 : 14 + rand() * 30;
    const shade = rand() < 0.5 ? "84,122,52" : "130,170,84";
    ctx.fillStyle = `rgba(${rim ? "100,140,62" : shade},${rim ? 0.22 : 0.1})`;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Item = { p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; c?: string };

/** One draw call for many copies of the same shape. */
function Instanced({ geometry, items, color, castShadow = true, receiveShadow = true }: { geometry: THREE.BufferGeometry; items: Item[]; color: string; castShadow?: boolean; receiveShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromEuler(e.set(...(it.r ?? [0, 0, 0])));
      m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
      mesh.setMatrixAt(i, m);
      if (it.c) mesh.setColorAt(i, c.set(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      <meshStandardMaterial color={items.some((i) => i.c) ? "#ffffff" : color} flatShading roughness={0.9} />
    </instancedMesh>
  );
}

function buildForest() {
  const rand = rng(21);
  const r = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const trunks: Item[] = [];
  const cones: Item[] = [];
  const blobs: Item[] = [];
  const rocks: Item[] = [];
  const tufts: Item[] = [];
  const flowers: Item[] = [];

  const pine = (x: number, z: number, h: number, y = 0) => {
    trunks.push({ p: [x, y + 0.25 * h, z], s: [0.07 * h, 0.5 * h, 0.07 * h] });
    for (let j = 0; j < 3; j++) {
      const rad = (0.55 - 0.13 * j) * h;
      cones.push({ p: [x, y + (0.55 + 0.38 * j) * h, z], s: [rad, 0.75 * h, rad], r: [0, r(0, 6), 0], c: pick(COLORS.leaves) });
    }
  };
  const leafy = (x: number, z: number, h: number, y = 0) => {
    trunks.push({ p: [x, y + 0.4 * h, z], s: [0.08 * h, 0.8 * h, 0.08 * h] });
    for (let j = 0; j < 4; j++) {
      const rad = r(0.3, 0.45) * h;
      blobs.push({ p: [x + r(-0.25, 0.25) * h, y + (0.9 + r(0, 0.35)) * h, z + r(-0.25, 0.25) * h], s: [rad, rad * 0.9, rad], r: [0, r(0, 6), 0], c: pick(COLORS.leaves) });
    }
  };
  const bush = (x: number, z: number, s: number, y = 0) => {
    for (let j = 0; j < 3; j++) {
      const rad = r(0.18, 0.3) * s;
      blobs.push({ p: [x + r(-0.2, 0.2) * s, y + 0.12 * s, z + r(-0.2, 0.2) * s], s: [rad, rad * 0.8, rad], c: pick(COLORS.leaves) });
    }
  };

  // A soft, uneven edge: bushes, ferns, mossy rocks and fallen logs instead of a hard rim.
  const edge = (a: number) => 1 + 0.08 * Math.sin(3 * a + 1.3) + 0.06 * Math.sin(7 * a + 0.4);
  const onEdge = (a: number, lo: number, hi: number) => {
    const f = edge(a) * r(lo, hi);
    return [CLEARING[0] * f * Math.cos(a), CLEARING[1] * f * Math.sin(a)] as const;
  };
  const fern = (x: number, z: number, s: number) => {
    for (let j = 0; j < 7; j++) {
      const h = r(0.25, 0.45) * s;
      tufts.push({ p: [x + r(-0.25, 0.25) * s, h / 2, z + r(-0.25, 0.25) * s], s: [0.07 * s, h, 0.07 * s], r: [r(-0.5, 0.5), r(0, 6), r(-0.5, 0.5)] });
    }
  };
  for (let k = 0; k < 300; k++) {
    const a = r(0, Math.PI * 2);
    const [x, z] = onEdge(a, 0.97, 1.2);
    if (!clearOfBoard(x, z, 0.7, 1)) continue;
    const front = z > 3; // near the camera: keep it low so the board stays in view
    const roll = rand();
    if (roll < 0.45) bush(x, z, front ? r(0.6, 1) : r(0.9, 1.6));
    else if (roll < 0.8) fern(x, z, front ? r(0.7, 1) : r(0.9, 1.4));
    else if (!front && roll < 0.93) (rand() < 0.5 ? pine : leafy)(x, z, r(1.1, 1.8));
  }
  for (let k = 0; k < 14; k++) {
    const a = r(0, Math.PI * 2);
    const [x, z] = onEdge(a, 0.95, 1.15);
    if (!clearOfBoard(x, z, 0.8, 1.1)) continue;
    const sz = r(0.25, 0.55);
    rocks.push({ p: [x, -0.05, z], s: [sz * r(0.9, 1.4), sz * r(0.5, 0.8), sz * r(0.9, 1.4)], r: [r(0, 0.4), r(0, 6), r(0, 0.4)], c: pick(COLORS.rocks) });
  }
  for (let k = 0; k < 4; k++) {
    const a = r(Math.PI * 1.1, Math.PI * 1.9); // behind the board
    const [x, z] = onEdge(a, 1.02, 1.1);
    trunks.push({ p: [x, 0.12, z], s: [0.13, r(1.2, 1.9), 0.13], r: [0, r(0, 6), Math.PI / 2] });
  }
  // Trees in the empty corners beside the triangle (far half of the clearing).
  for (let n = 0, tries = 0; n < 12 && tries < 3000; tries++) {
    const x = r(-7.8, 7.8) * SPREAD;
    const z = r(-7.6, -1) * SPREAD;
    if (!insideClearing(x, z, 0.6) || !clearOfBoard(x, z, 0.9, 1.1) || inPen(x, z, 0.6)) continue;
    (rand() < 0.6 ? pine : leafy)(x, z, r(0.8, 1.25));
    n++;
  }
  // Bushes, grass and flowers inside the clearing.
  for (let k = 0; k < 600; k++) {
    const x = r(-8.6, 8.6) * SPREAD;
    const z = r(-8.2, 8.2) * SPREAD;
    if (insideClearing(x, z, 0.4) && clearOfBoard(x, z, 0.55, 0.8) && !inPen(x, z, 0.3) && rand() < 0.1) bush(x, z, r(0.6, 1));
  }
  for (let k = 0; k < 9000; k++) {
    const x = r(-12, 12) * SPREAD;
    const z = r(-11.5, 11.5) * SPREAD;
    const inside = insideClearing(x, z, 0.2);
    if (!inside && ((x / (CLEARING[0] * 1.35)) ** 2 + (z / (CLEARING[1] * 1.35)) ** 2 > 1 || rand() < 0.6)) continue;
    if (!clearOfBoard(x, z, 0.2, 0.45)) continue;
    tufts.push({ p: [x, 0.06, z], s: [0.05, r(0.1, 0.2), 0.05], r: [r(-0.2, 0.2), r(0, 6), r(-0.2, 0.2)] });
    if (rand() < 0.05) flowers.push({ p: [x + 0.05, 0.13, z], s: [0.04, 0.04, 0.04], c: pick(COLORS.flowers) });
  }
  // Forest wall behind and beside the clearing.
  for (let k = 0; k < 80; k++) {
    const a = r(-0.25, Math.PI + 0.25);
    const d = r(10.5, 21) * SPREAD;
    (rand() < 0.65 ? pine : leafy)(d * Math.cos(a) * 1.15, -d * Math.sin(a), r(1.6, 3.4));
  }
  for (let k = 0; k < 25; k++) {
    const a = r(Math.PI + 0.3, 2 * Math.PI - 0.3);
    const d = r(10.5, 14) * SPREAD;
    bush(d * Math.cos(a) * 1.15, -d * Math.sin(a), r(1, 1.8));
  }
  return { trunks, cones, blobs, rocks, tufts, flowers };
}

let mossTexture: THREE.CanvasTexture | null = null;
const clearingTextureOnce = () => (mossTexture ??= clearingTexture());

// The same for every player, so build it once.
const FOREST = buildForest();

/** Things a walker bumps into inside the clearing: standing trunks and rocks, as circles (x, z, radius). */
export const OBSTACLES: { x: number; z: number; r: number }[] = [
  // Trunk height is 0.5–0.8 of the tree, so this covers the lowest branches at eye height too.
  ...FOREST.trunks.filter((t) => !t.r && insideClearing(t.p[0], t.p[2], -1)).map((t) => ({ x: t.p[0], z: t.p[2], r: t.s[1] * 0.9 + 0.3 })),
  ...FOREST.rocks.filter((t) => insideClearing(t.p[0], t.p[2], -1)).map((t) => ({ x: t.p[0], z: t.p[2], r: Math.max(t.s[0], t.s[2]) + 0.25 })),
];
const STONES = (() => {
  const rand = rng(7);
  return POINTS_3D.map(([x, z]) => ({ x, z, rot: rand() * 6.28, sx: 0.95 + rand() * 0.15, sz: 0.9 + rand() * 0.15 }));
})();

export function Forest() {
  const geo = useMemo(
    () => ({
      cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
      cone: new THREE.ConeGeometry(1, 1, 9),
      ico: new THREE.IcosahedronGeometry(1, 0),
      tuft: new THREE.ConeGeometry(1, 1, 3),
      stone: new THREE.CylinderGeometry(0.47, 0.47, 0.1, 14),
    }),
    [],
  );
  const f = FOREST;
  const moss = useMemo(() => clearingTextureOnce(), []);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -10]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={COLORS.ground} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} scale={[CLEARING[0] * 2.6, CLEARING[1] * 2.6, 1]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={moss} transparent depthWrite={false} roughness={1} />
      </mesh>
      {SEGMENTS_3D.map(([[ax, az], [bx, bz]], i) => (
        <mesh key={i} position={[(ax + bx) / 2, 0.012, (az + bz) / 2]} rotation-y={-Math.atan2(bz - az, bx - ax)} receiveShadow>
          <boxGeometry args={[Math.hypot(bx - ax, bz - az) + 0.15, 0.02, 0.2]} />
          <meshStandardMaterial color={COLORS.dirt} roughness={1} />
        </mesh>
      ))}
      {STONES.map((s, i) => (
        <mesh key={i} geometry={geo.stone} position={[s.x, 0.04, s.z]} rotation-y={s.rot} scale={[s.sx, 1, s.sz]} receiveShadow>
          <meshStandardMaterial color={COLORS.stone} flatShading roughness={0.8} />
        </mesh>
      ))}
      <Instanced geometry={geo.ico} items={f.rocks} color={COLORS.rocks[0]} />
      <Instanced geometry={geo.cyl} items={f.trunks} color={COLORS.bark} />
      <Instanced geometry={geo.cone} items={f.cones} color={COLORS.leaves[0]} />
      <Instanced geometry={geo.ico} items={f.blobs} color={COLORS.leaves[1]} />
      <Instanced geometry={geo.tuft} items={f.tufts} color={COLORS.grass} castShadow={false} />
      <Instanced geometry={geo.ico} items={f.flowers} color={COLORS.flowers[0]} castShadow={false} />
    </group>
  );
}

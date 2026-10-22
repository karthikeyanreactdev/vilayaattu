"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Bubble, showBubble } from "../three/Bubble";
import { FIGURE_SCALE, Figure, type PieceType, type Side } from "./Figures";
import { FACING } from "./layout";

export type Vec = [number, number];

/** What the latest move asks the figures to act out. */
export type Plan = {
  moveNo: number;
  moverId: string;
  moverType: PieceType;
  from: Vec;
  to: Vec;
  victim: { id: string; type: PieceType; side: Side; at: Vec } | null;
  /** Clock time the act began; set by whichever figure sees the plan first. */
  start: number | null;
};

/** Seconds from the start of the attack swing until the blow lands, per attacker. */
const STRIKE: Record<PieceType, number> = { p: 0.45, b: 0.75, k: 0.5, q: 0.65, n: 0.5, r: 0.55 };
/** The bow man and the Rani strike from where they stand. */
const RANGED: Record<PieceType, boolean> = { p: false, b: true, k: false, q: true, n: false, r: false };
/** Melee attackers stop this far short of their victim. */
const REACH = 0.62;
const SPEED = 0.42; // seconds per square of walking

const dist = (a: Vec, b: Vec) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
const nearAngle = (from: number, to: number) => from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

/** Where a capture's beats fall, in seconds from the plan's start. */
export function captureBeats(plan: Plan) {
  const v = plan.victim!.at;
  const ranged = RANGED[plan.moverType];
  const d = dist(plan.from, v);
  const stop: Vec = ranged ? plan.from : [v[0] - ((v[0] - plan.from[0]) / d) * REACH, v[1] - ((v[1] - plan.from[1]) / d) * REACH];
  const approach = ranged ? 0 : plan.moverType === "n" ? 0.9 : Math.max(0.35, (d - REACH) * SPEED);
  const hit = approach + STRIKE[plan.moverType];
  const stepIn = hit + 0.55;
  const stepDur = Math.max(0.35, dist(stop, plan.to) * SPEED);
  return { stop, approach, hit, stepIn, done: stepIn + stepDur };
}

/** Named joints of a figure, posed as offsets from their rest rotation each frame. */
class Rig {
  private joints = new Map<string, { obj: THREE.Object3D; base: THREE.Euler }>();
  constructor(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o.name && !this.joints.has(o.name)) this.joints.set(o.name, { obj: o, base: o.rotation.clone() });
    });
  }
  reset() {
    for (const { obj, base } of this.joints.values()) obj.rotation.copy(base);
    const body = this.joints.get("body");
    if (body) body.obj.position.set(0, 0, 0);
  }
  rot(name: string, x = 0, y = 0, z = 0) {
    const j = this.joints.get(name);
    if (j) j.obj.rotation.set(j.base.x + x, j.base.y + y, j.base.z + z);
  }
  lift(y: number, z = 0) {
    this.joints.get("body")?.obj.position.set(0, y, z);
  }
}

const PEOPLE: PieceType[] = ["k", "q", "b", "p"];

/** Legs and arms in motion; `a` scales the stride. */
function gait(rig: Rig, type: PieceType, ph: number, a = 1) {
  const s = Math.sin(ph);
  if (PEOPLE.includes(type)) {
    if (type === "q") rig.rot("legL", 0, 0, 0.08 * s * a);
    else {
      rig.rot("legL", 0.7 * s * a);
      rig.rot("legR", -0.7 * s * a);
    }
    rig.rot("armL", -0.5 * s * a);
    rig.rot("armR", 0.5 * s * a);
    rig.rot("cape", 0.15 * a + 0.05 * Math.sin(ph * 2));
  } else if (type === "n") {
    rig.rot("legFL", 0.8 * s * a);
    rig.rot("legFR", 0.8 * Math.sin(ph + 0.7) * a);
    rig.rot("legBL", -0.8 * s * a);
    rig.rot("legBR", -0.8 * Math.sin(ph + 0.7) * a);
    rig.rot("neck", 0.12 * Math.sin(ph * 2) * a);
    rig.rot("tail", 0.4 * a, 0, 0.2 * s);
  } else {
    rig.rot("legFL", 0.35 * s * a);
    rig.rot("legBR", 0.35 * s * a);
    rig.rot("legFR", -0.35 * s * a);
    rig.rot("legBL", -0.35 * s * a);
    rig.rot("earL", 0, 0.3 * Math.abs(s) * a);
    rig.rot("earR", 0, -0.3 * Math.abs(s) * a);
    rig.rot("trunk0", 0, 0, 0.25 * Math.sin(ph * 0.5) * a);
  }
}

/** Little signs of life while standing. */
function idle(rig: Rig, type: PieceType, t: number, seed: number) {
  if (PEOPLE.includes(type)) {
    rig.rot("head", 0, 0.35 * Math.sin(t * 0.6 + seed) * (Math.sin(t * 0.21 + seed) > 0.3 ? 1 : 0.2));
    rig.rot("cape", 0.04 + 0.03 * Math.sin(t * 1.7 + seed));
    rig.rot("armL", 0.05 * Math.sin(t * 1.3 + seed));
    rig.rot("armR", -0.05 * Math.sin(t * 1.3 + seed));
  } else if (type === "n") {
    rig.rot("neck", 0.08 * Math.sin(t * 1.4 + seed));
    rig.rot("tail", 0.2, 0, 0.35 * Math.sin(t * 2.6 + seed));
    if (Math.sin(t * 0.5 + seed) > 0.95) rig.rot("legFR", -0.5 * Math.sin(t * 18)); // hoof stamp
  } else {
    rig.rot("earL", 0, 0.25 * Math.sin(t * 1.1 + seed));
    rig.rot("earR", 0, -0.25 * Math.sin(t * 1.1 + seed));
    const sway = Math.sin(t * 0.9 + seed);
    rig.rot("trunk0", 0.1 * sway, 0, 0.2 * Math.sin(t * 0.7 + seed));
    rig.rot("trunk1", 0.15 * sway);
    rig.rot("trunk2", 0.2 * sway);
    rig.rot("tail", 0, 0, 0.3 * Math.sin(t * 2 + seed));
    // The archer on top looks about.
    rig.rot("head", 0, 0.5 * Math.sin(t * 0.5 + seed));
  }
}

/** The attack itself; `s` is seconds since the swing began. */
function strike(rig: Rig, type: PieceType, s: number) {
  switch (type) {
    case "p": {
      // Spear thrust.
      const wind = seg(s, 0, 0.25);
      const thrust = seg(s, 0.25, 0.42);
      const back = seg(s, 0.6, 0.85);
      rig.rot("armR", (0.6 * wind - 2.1 * thrust) * (1 - back));
      rig.rot("armL", -0.4 * (1 - back));
      rig.rot("body", 0.25 * thrust * (1 - back));
      break;
    }
    case "k": {
      // Talwar raised high, then chopped down.
      const up = seg(s, 0, 0.35);
      const chop = seg(s, 0.35, 0.5);
      const back = seg(s, 0.7, 0.95);
      rig.rot("armR", (-2.9 * up + 2.4 * chop) * (1 - back), 0, -0.3 * up * (1 - back));
      rig.rot("body", 0.2 * chop * (1 - back), -0.3 * up * (1 - chop));
      break;
    }
    case "q": {
      // Sceptre raised, magic sent.
      const up = seg(s, 0, 0.3);
      const back = seg(s, 0.8, 1.05);
      rig.rot("armR", -2.6 * up * (1 - back));
      rig.rot("armL", -0.8 * up * (1 - back), 0, 0.6 * up * (1 - back));
      break;
    }
    case "b": {
      // Bow raised, string drawn, arrow loosed.
      const aim = seg(s, 0, 0.3);
      const draw = seg(s, 0.2, 0.5) * (1 - seg(s, 0.5, 0.55));
      const back = seg(s, 0.9, 1.15);
      rig.rot("armL", -1.55 * aim * (1 - back));
      rig.rot("armR", -1.4 * aim * (1 - back), 0, 0.6 * draw);
      break;
    }
    case "n": {
      // Rear up, kick, slam down.
      const rear = seg(s, 0, 0.3) * (1 - seg(s, 0.35, 0.5));
      rig.rot("body", -0.65 * rear);
      rig.lift(0.18 * rear, -0.1 * rear);
      rig.rot("legFL", -1.1 * rear + 0.5 * Math.sin(s * 30) * rear);
      rig.rot("legFR", -1.1 * rear - 0.5 * Math.sin(s * 30) * rear);
      rig.rot("neck", -0.4 * rear);
      break;
    }
    case "r": {
      // Elephant rears, trunk high, then stomps.
      const rear = seg(s, 0, 0.4) * (1 - seg(s, 0.42, 0.55));
      rig.rot("body", -0.45 * rear);
      rig.lift(0.15 * rear, -0.12 * rear);
      rig.rot("legFL", -0.8 * rear);
      rig.rot("legFR", -0.8 * rear);
      rig.rot("trunk0", -0.9 * rear);
      rig.rot("trunk1", -0.5 * rear);
      rig.rot("trunk2", -0.5 * rear);
      rig.rot("earL", 0, 0.6 * rear);
      rig.rot("earR", 0, -0.6 * rear);
      break;
    }
  }
}

type Mode =
  | { kind: "idle" }
  | { kind: "walk"; start: number; from: THREE.Vector2; to: THREE.Vector2; dur: number; jump: boolean }
  | { kind: "capture"; plan: Plan };

const ARROW_GEO = new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6).rotateX(Math.PI / 2);
const ARROW_MAT = new THREE.MeshStandardMaterial({ color: "#c9a46a" });
const MAGIC_GEO = new THREE.IcosahedronGeometry(0.08, 0);
const MAGIC_MAT = new THREE.MeshStandardMaterial({ color: "#ffd84a", emissive: "#ffb300", emissiveIntensity: 2 });

/** One chess piece, acting out moves, captures, check and victory. */
export function Actor({
  id,
  type,
  side,
  at,
  planRef,
  selected,
  inCheck,
  fallen,
  cheering,
  onPick,
}: {
  id: string;
  type: PieceType;
  side: Side;
  at: Vec;
  planRef: RefObject<Plan | null>;
  selected: boolean;
  /** This king is in check. */
  inCheck: boolean;
  /** This king has been checkmated. */
  fallen: boolean;
  /** This piece's side has won. */
  cheering: boolean;
  /** Tapping the figure picks its square. */
  onPick: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const shot = useRef<THREE.Mesh>(null);
  const bubble = useRef<THREE.Sprite>(null);
  const rig = useRef<{ type: PieceType; rig: Rig } | null>(null);
  const pos = useRef(new THREE.Vector2(...at));
  const yaw = useRef<number>(FACING[side]);
  const mode = useRef<Mode>({ kind: "idle" });
  const lastAt = useRef(at.join());
  const seed = useMemo(() => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) * 0.37, [id]);
  const promotedAt = useRef<number | null>(null);
  const fallAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    if (!rig.current || rig.current.type !== type) {
      if (rig.current) promotedAt.current = t; // a pawn just became something grander
      rig.current = { type, rig: new Rig(g) };
    }
    const r = rig.current.rig;
    r.reset();

    // A new square: work out how to get there.
    const key = at.join();
    if (key !== lastAt.current) {
      lastAt.current = key;
      const plan = planRef.current;
      if (plan && plan.moverId === id && plan.victim) {
        plan.start ??= t;
        mode.current = { kind: "capture", plan };
      } else {
        if (plan && plan.moverId === id) plan.start ??= t;
        const to = new THREE.Vector2(...at);
        const d = pos.current.distanceTo(to);
        mode.current = { kind: "walk", start: t, from: pos.current.clone(), to, dur: type === "n" ? 0.9 : Math.max(0.45, d * SPEED), jump: type === "n" };
      }
    }

    let y = 0;
    const m = mode.current;
    if (shot.current) shot.current.visible = false;
    if (m.kind === "walk") {
      const u = clamp01((t - m.start) / m.dur);
      pos.current.lerpVectors(m.from, m.to, m.jump ? ease(u) : u);
      const dir = m.to.clone().sub(m.from);
      if (dir.lengthSq() > 0) yaw.current = nearAngle(yaw.current, yawTo(dir.x, dir.y));
      if (m.jump) y = 4 * 0.9 * u * (1 - u);
      else y = Math.abs(Math.sin(t * 11)) * 0.035;
      gait(r, type, t * (type === "r" ? 7 : 11), u < 1 ? 1 : 0);
      if (u >= 1) mode.current = { kind: "idle" };
    } else if (m.kind === "capture") {
      const plan = m.plan;
      const b = captureBeats(plan);
      const el = t - (plan.start ?? t);
      const v = plan.victim!.at;
      if (el < b.approach) {
        const u = el / b.approach;
        pos.current.set(...plan.from).lerp(new THREE.Vector2(...b.stop), type === "n" ? ease(u) : u);
        yaw.current = nearAngle(yaw.current, yawTo(b.stop[0] - plan.from[0], b.stop[1] - plan.from[1]));
        y = type === "n" ? 4 * 0.9 * u * (1 - u) : Math.abs(Math.sin(t * 11)) * 0.035;
        gait(r, type, t * (type === "r" ? 7 : 11));
      } else if (el < b.stepIn) {
        pos.current.set(...b.stop);
        yaw.current = nearAngle(yaw.current, yawTo(v[0] - b.stop[0], v[1] - b.stop[1]));
        strike(r, type, el - b.approach);
        // Arrow or magic flies to the victim just before the blow lands.
        if (RANGED[type] && shot.current) {
          const fly = seg(el, b.hit - 0.28, b.hit);
          if (fly > 0 && fly < 1) {
            shot.current.visible = true;
            shot.current.position.set(0, 0.62 * FIGURE_SCALE + Math.sin(fly * Math.PI) * 0.25, 0.25 + fly * (dist(b.stop, v) - 0.25));
          }
        }
      } else if (el < b.done) {
        const u = seg(el, b.stepIn, b.done);
        pos.current.set(...b.stop).lerp(new THREE.Vector2(...plan.to), u);
        yaw.current = nearAngle(yaw.current, yawTo(plan.to[0] - b.stop[0], plan.to[1] - b.stop[1]));
        y = Math.abs(Math.sin(t * 11)) * 0.035;
        gait(r, type, t * 11);
      } else {
        pos.current.set(...plan.to);
        mode.current = { kind: "idle" };
      }
    } else {
      // Turn back to face the enemy, then fidget.
      yaw.current += (nearAngle(yaw.current, FACING[side]) - yaw.current) * 0.06;
      idle(r, type, t, seed);
    }

    if (cheering && m.kind === "idle") {
      const hop = Math.max(0, Math.sin(t * 6 + seed));
      y = hop * 0.25;
      r.rot("armL", -2.8, 0, 0.3);
      r.rot("armR", -2.8, 0, -0.3);
      r.rot("trunk0", -0.9);
    }
    if (inCheck && type === "k") {
      // Panic: arms up, shaking.
      r.rot("armL", -2.6, 0, 0.4);
      r.rot("armR", -2.6, 0, -0.4);
      r.rot("body", 0, 0, 0.05 * Math.sin(t * 40));
    }
    if (fallen) {
      fallAt.current ??= t;
      const u = ease(seg(t, fallAt.current + 1.2, fallAt.current + 1.8));
      r.rot("body", -1.5 * u);
      r.lift(0.08 * u, -0.1 * u);
    }
    if (promotedAt.current !== null) {
      const u = seg(t, promotedAt.current, promotedAt.current + 0.8);
      g.scale.setScalar(u < 1 ? 1 + Math.sin(u * Math.PI) * 0.35 : 1);
      g.rotation.y = yaw.current + (1 - u) * Math.PI * 4;
      if (u >= 1) promotedAt.current = null;
    } else g.rotation.y = yaw.current;
    if (selected) y += 0.15 + Math.sin(t * 6) * 0.04;
    showBubble(bubble.current, inCheck && type === "k" && !fallen);
    g.position.set(pos.current.x, y, pos.current.y);
  });

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta < 8) onPick(); // ignore the end of a camera drag
      }}
    >
      <Figure type={type} side={side} />
      <mesh ref={shot} geometry={type === "q" ? MAGIC_GEO : ARROW_GEO} material={type === "q" ? MAGIC_MAT : ARROW_MAT} visible={false} />
      {type === "k" && <Bubble text="CHECK!" height={1.45 * FIGURE_SCALE} bubbleRef={bubble} />}
    </group>
  );
}

/** A captured piece: cowers, is knocked flat when the blow lands, then bursts into bricks. */
export function Fallen({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const victim = plan.victim!;
  const root = useRef<THREE.Group>(null);
  const rig = useRef<Rig | null>(null);
  const bricks = useRef<{ mesh: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3 }[] | null>(null);
  const done = useRef(false);
  const beats = useMemo(() => captureBeats(plan), [plan]);
  const yaw = useMemo(() => yawTo(beats.stop[0] - victim.at[0], beats.stop[1] - victim.at[1]), [beats, victim]);
  const lastT = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const dt = Math.min(0.05, t - (lastT.current || t));
    lastT.current = t;
    const g = root.current;
    if (!g) return;
    plan.start ??= t;
    const el = t - plan.start;
    rig.current ??= new Rig(g);
    const r = rig.current;
    if (!bricks.current) r.reset();

    if (el < beats.hit) {
      // Cower: arms up, trembling.
      r.rot("armL", -2.7, 0, 0.5);
      r.rot("armR", -2.7, 0, -0.5);
      r.rot("body", 0, 0, 0.04 * Math.sin(el * 45));
      r.rot("earL", 0, 0.5 * Math.sin(el * 20));
      r.rot("trunk0", -0.6);
    } else if (el < beats.hit + 0.45) {
      // Knocked flat on its back.
      const u = ease(seg(el, beats.hit, beats.hit + 0.4));
      r.rot("body", -1.5 * u);
      r.lift(0.25 * Math.sin(u * Math.PI) + 0.06 * u, -0.25 * u);
    } else {
      // Burst into bricks that tumble and shrink away.
      if (!bricks.current) {
        const list: { mesh: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3 }[] = [];
        g.traverse((o) => {
          if ((o as THREE.Mesh).isMesh)
            list.push({
              mesh: o,
              v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4),
              spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
            });
        });
        bricks.current = list;
      }
      const shrink = 1 - seg(el, beats.hit + 1.0, beats.hit + 1.5);
      for (const b of bricks.current) {
        b.v.y -= 6 * dt;
        b.mesh.position.addScaledVector(b.v, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        b.mesh.rotation.z += b.spin.z * dt;
      }
      g.scale.setScalar(Math.max(0.001, shrink));
      if (el > beats.hit + 1.55 && !done.current) {
        done.current = true;
        onDone();
      }
    }
    g.position.set(victim.at[0], 0, victim.at[1]);
    g.rotation.y = yaw;
  });

  return (
    <group ref={root}>
      <Figure type={victim.type} side={victim.side} />
    </group>
  );
}

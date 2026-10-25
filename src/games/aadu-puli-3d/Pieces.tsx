"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLIPS, CreatureBody, useCreature, type Kind } from "./Creature";
import { PEN_SPOTS, POINTS_3D } from "./layout";
import { Bubble, showBubble } from "../three/Bubble";
import type { MoodInfo } from "./moods";

/** Timing of the tiger's attack jump, in seconds; the caught goat is timed against it. */
export const POUNCE = { lift: 0.35, land: 2.1, end: 2.48, height: 1.1 };
/** When the tiger is right above the goat. */
const OVERHEAD = (POUNCE.lift + POUNCE.land) / 2;

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Turn to face a direction on the ground; yaw 0 looks down +Z, at the camera. */
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
/** Shortest way round to the target yaw. */
const nearAngle = (from: number, to: number) => from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

const NOD_AXIS = new THREE.Vector3(1, 0, 0);
const nod = new THREE.Quaternion();

/** The tiger's neck bone: tilting it rears the head back (negative) or dips it (positive). */
function findNeck(scene: THREE.Object3D) {
  return scene.getObjectByName("Bone016_021") ?? scene.getObjectByName("Bone.016_021") ?? null;
}


type Anim =
  | { type: "idle" }
  | { type: "drop"; start: number }
  | { type: "move"; start: number; dur: number; from: THREE.Vector2; to: THREE.Vector2 }
  | { type: "pounce"; start: number; from: THREE.Vector2; to: THREE.Vector2 }
  | { type: "showoff"; until: number }
  | { type: "victory"; start: number };

/** After a kill: turn to the camera, two proud hops, then a roar at the sky. Seconds. */
const VICTORY = { turn: 0.35, hops: [0.4, 0.95], hop: 0.4, roar: [1.4, 2.4], end: 2.7 };

export function Piece({
  kind,
  index,
  moveNo,
  captureMove,
  selected,
  mood,
  focused,
  onTap,
}: {
  kind: Kind;
  index: number;
  moveNo: number;
  /** True when this piece's latest move captured a goat. */
  captureMove: boolean;
  selected: boolean;
  /** How the animal feels about its spot; drives posture, and the bubble when looked at. */
  mood: MoodInfo | null;
  /** The walker's crosshair is on this animal: say the mood out loud. */
  focused: boolean;
  onTap: (index: number) => void;
}) {
  const nervous = mood?.mood === "nervous" || mood?.mood === "doomed";
  const { scene, play, fit } = useCreature(kind);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const anim = useRef<Anim>(kind === "G" ? { type: "drop", start: -1 } : { type: "idle" });
  const pos = useRef(new THREE.Vector2(...POINTS_3D[index]));
  // Three-quarter turn so the animals read from the camera; goats face the tigers.
  const side = POINTS_3D[index][0] > 0.1 ? -1 : 1;
  const yaw = useRef((kind === "T" ? 0 : Math.PI) + side * (kind === "T" ? 0.35 : -0.9));
  const lastIndex = useRef(index);
  const clock = useRef(0);
  const clip = useRef("");
  const nextHop = useRef(3 + (index % 5));
  const neck = useMemo(() => (kind === "T" ? findNeck(scene) : null), [kind, scene]);
  const bubble = useRef<THREE.Sprite>(null);
  const yum = useRef<THREE.Sprite>(null);
  const moodBubble = useRef<THREE.Sprite>(null);
  const moodRef = useRef(mood);
  const focusedRef = useRef(focused);
  useLayoutEffect(() => {
    moodRef.current = mood;
    focusedRef.current = focused;
  }, [mood, focused]);

  /** Switch clips only when the wanted one changes. */
  const want = (name: string, opts?: Parameters<typeof play>[1]) => {
    if (clip.current === name) return;
    clip.current = name;
    play(name, opts);
  };

  useEffect(() => {
    if (kind === "T") {
      clip.current = CLIPS.T.idle;
      play(CLIPS.T.idle, { randomStart: true });
    }
  }, [kind, play]);

  // A new position means this piece moved.
  useEffect(() => {
    if (index === lastIndex.current) return;
    lastIndex.current = index;
    const to = new THREE.Vector2(...POINTS_3D[index]);
    const from = pos.current.clone();
    const t = clock.current;
    if (kind === "T" && captureMove) {
      anim.current = { type: "pounce", start: t, from, to };
      clip.current = CLIPS.T.attack;
      play(CLIPS.T.attack, { once: true, fade: 0.15 });
    } else {
      const dur = kind === "T" ? Math.max(0.9, from.distanceTo(to) * 0.45) : 0.65;
      anim.current = { type: "move", start: t, dur, from, to };
      if (kind === "T") want(CLIPS.T.walk, { speed: 1.6 });
      else want(CLIPS.G.hop, { once: true, fade: 0.1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, moveNo, captureMove, kind, play]);

  useFrame(({ clock: c, camera }) => {
    const t = c.elapsedTime;
    clock.current = t;
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const a = anim.current;
    let y = 0;
    let sx = 1;
    let sy = 1;
    let wiggle = 0;

    if (a.type === "drop") {
      // A placed goat lands from the sky, then cheers.
      if (a.start < 0) a.start = t;
      const u = t - a.start;
      if (u < 0.45) y = 4 * (1 - (u / 0.45) ** 2);
      else if (u < 0.6) [sx, sy] = [1.2, 0.75];
      else {
        anim.current = { type: "showoff", until: t + play(CLIPS.G.happy, { once: true, fade: 0.1 }) };
        clip.current = CLIPS.G.happy;
      }
    } else if (a.type === "move") {
      const u = (t - a.start) / a.dur;
      pos.current.lerpVectors(a.from, a.to, kind === "T" ? clamp01(u) : ease(clamp01(u)));
      yaw.current = nearAngle(yaw.current, yawTo(a.to.x - a.from.x, a.to.y - a.from.y));
      if (kind === "G") y = Math.sin(Math.PI * clamp01(u)) * 0.45;
      if (u >= 1) anim.current = { type: "idle" };
    } else if (a.type === "pounce") {
      const u = t - a.start;
      yaw.current = nearAngle(yaw.current, yawTo(a.to.x - a.from.x, a.to.y - a.from.y));
      const k = ease(seg(u, POUNCE.lift, POUNCE.land));
      pos.current.lerpVectors(a.from, a.to, k);
      y = 4 * POUNCE.height * k * (1 - k);
      // Roar: rear the head back, then snap it forward into the leap.
      if (neck && u < 0.9) neck.quaternion.multiply(nod.setFromAxisAngle(NOD_AXIS, -0.55 * Math.sin((Math.PI * u) / 0.9)));
      showBubble(bubble.current, u < 1.1);
      if (u >= POUNCE.end) {
        anim.current = { type: "victory", start: t };
        want(CLIPS.T.idle, { fade: 0.3 });
      }
    } else if (a.type === "victory") {
      const u = t - a.start;
      yaw.current = lerp(yaw.current, nearAngle(yaw.current, 0), seg(u, 0, VICTORY.turn) * 0.25);
      for (const h0 of VICTORY.hops) {
        const k = seg(u, h0, h0 + VICTORY.hop);
        if (k > 0 && k < 1) {
          y = Math.sin(k * Math.PI) * 0.45;
          [sx, sy] = [0.94, 1.08];
        } else if (u >= h0 + VICTORY.hop && u < h0 + VICTORY.hop + 0.12) [sx, sy] = [1.1, 0.88]; // landing squash
      }
      // Throw the head back and roar at the sky.
      const r = seg(u, VICTORY.roar[0], VICTORY.roar[1]);
      if (neck && r > 0 && r < 1) neck.quaternion.multiply(nod.setFromAxisAngle(NOD_AXIS, -0.7 * Math.sin(r * Math.PI)));
      showBubble(yum.current, u > 0.2 && u < VICTORY.roar[1]);
      if (u >= VICTORY.end) anim.current = { type: "idle" };
    } else if (a.type === "showoff") {
      if (t >= a.until) anim.current = { type: "idle" };
    } else if (kind === "T") {
      want(CLIPS.T.idle, { fade: 0.4 });
      const m = moodRef.current?.mood;
      if (neck && m === "pounce") {
        // Ready to pounce: head low, shoulders down, a slow coiled rock.
        neck.quaternion.multiply(nod.setFromAxisAngle(NOD_AXIS, 0.35 + Math.sin(t * 2.2) * 0.08));
        sy = 0.93;
        sx = 1.03;
      } else if (neck && m === "trapped") {
        // Trapped: sulking, head hung, the odd angry shake.
        neck.quaternion.multiply(nod.setFromAxisAngle(NOD_AXIS, 0.5));
        wiggle = Math.sin(t * 18) * 0.02 * Math.max(0, Math.sin(t * 0.7));
      } else if (neck && m === "cornered") {
        neck.quaternion.multiply(nod.setFromAxisAngle(NOD_AXIS, Math.sin(t * 1.4) * 0.25));
      }
    } else {
      // Goats: calm loop, scared crouch next to a tiger, and the odd nervous hop.
      const h = t - nextHop.current;
      if (h > 0 && h < 0.6) {
        y = Math.sin((h / 0.6) * Math.PI) * 0.2;
        want(CLIPS.G.hop, { once: true, fade: 0.1 });
      } else {
        if (h >= 0.6) nextHop.current = t + (nervous ? 2 : 4) + Math.random() * 5;
        want(nervous ? CLIPS.G.nervous : CLIPS.G.idle, { fade: 0.3 });
        if (nervous) wiggle = Math.sin(t * 40) * (moodRef.current?.mood === "doomed" ? 0.05 : 0.025);
        if (moodRef.current?.mood === "doomed") sy = 0.92; // cowering
        if (moodRef.current?.mood === "proud") y += Math.max(0, Math.sin(t * 4)) * 0.06; // a cheeky bounce
      }
    }
    if (selected) y += 0.25 + Math.sin(t * 6) * 0.06;
    if (a.type !== "pounce") showBubble(bubble.current, false);
    if (a.type !== "victory") showBubble(yum.current, false);
    // The mood bubble only while the walker looks this way, and never over the action bubbles.
    // Up close it would fill the screen, so it shrinks with distance to the camera.
    const near = THREE.MathUtils.clamp(camera.position.distanceTo(g.position) / 7, 0.4, 1);
    showBubble(moodBubble.current, focusedRef.current && !!moodRef.current && a.type !== "pounce" && a.type !== "victory" && a.type !== "drop", near);

    g.position.set(pos.current.x, y, pos.current.y);
    g.rotation.y = yaw.current + wiggle;
    b.scale.set(sx, sy, sx);
  });

  const tap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 8) onTap(lastIndex.current); // ignore the end of a camera drag
  };

  return (
    <group ref={root} onClick={tap}>
      <group ref={body}>
        <CreatureBody scene={scene} fit={fit} />
      </group>
      {kind === "T" && <Bubble text="ROAR! 🐯" height={1.9} bubbleRef={bubble} />}
      {kind === "T" && <Bubble text="YUM! 😋" height={1.9} bubbleRef={yum} />}
      {mood && <Bubble text={mood.bubble} height={kind === "T" ? 1.7 : 1.5} bubbleRef={moodBubble} />}
    </group>
  );
}

/** Flat five-point star for the cartoon effects. */
export function useStarGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1 : 0.45;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  }, []);
}

const STAR_MAT = new THREE.MeshStandardMaterial({ color: "#ffcc1a", emissive: "#ffb300", emissiveIntensity: 1.2 });
const PUFF_MAT = new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 1 });

/**
 * The caught goat: crouches in fear, gets squashed flat as the tiger lands on it,
 * pops back up feeling sick, then spins away in a puff of smoke.
 */
export function DyingGoat({ index, onDone }: { index: number; onDone: () => void }) {
  const { scene, play, fit } = useCreature("G");
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.Group>(null);
  const start = useRef(-1);
  const stage = useRef(0);
  const sickUntil = useRef(0);
  const done = useRef(false);
  const star = useStarGeometry();
  const puffGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const bubble = useRef<THREE.Sprite>(null);
  const [x, z] = POINTS_3D[index];
  const flat = OVERHEAD + 0.25;

  useEffect(() => {
    play(CLIPS.G.nervous);
  }, [play]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (start.current < 0) start.current = t;
    const u = t - start.current;
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    let y = 0;
    let s: [number, number] = [1, 1];
    let spin = 0;
    const up = flat + 0.7;
    if (u < flat) {
      g.rotation.z = Math.sin(u * 45) * 0.03; // trembling
    } else if (u < flat + 0.55) {
      g.rotation.z = 0;
      s = [1.6, 0.14]; // pancake!
    } else if (u < up) {
      const k = seg(u, flat + 0.55, up);
      y = Math.sin(k * Math.PI) * 0.5;
      s = [lerp(0.8, 1, k), lerp(1.3, 1, k)];
    } else {
      if (stage.current === 0) {
        stage.current = 1;
        sickUntil.current = up + play(CLIPS.G.caught, { once: true, fade: 0.1 });
      }
      if (u > sickUntil.current) {
        const k = seg(u, sickUntil.current, sickUntil.current + 0.45);
        y = k * 2.2;
        s = [1 - k, 1 - k];
        spin = k * Math.PI * 6;
      }
    }
    showBubble(bubble.current, stage.current === 1 && u < sickUntil.current);
    g.position.set(x, y, z);
    g.rotation.y = Math.PI / 2 + spin;
    b.scale.set(s[0], s[1], s[0]);

    // Stars burst out when the goat is flattened.
    const sk = seg(u, flat, flat + 0.6);
    stars.current?.children.forEach((c, i) => {
      const a = (i / 8) * Math.PI * 2;
      const r = sk * 1.4;
      c.position.set(Math.cos(a) * r, 0.3 + Math.sin(sk * Math.PI) * 0.9, Math.sin(a) * r);
      c.rotation.set(0, a + sk * 4, 0);
      c.scale.setScalar(sk > 0 && sk < 1 ? 0.2 * Math.sin(sk * Math.PI) + 0.05 : 0);
    });
    // A puff of smoke where it vanishes.
    const pStart = sickUntil.current || Infinity;
    const pk = seg(u, pStart + 0.3, pStart + 0.85);
    puffs.current?.children.forEach((c, i) => {
      const a = (i / 7) * Math.PI * 2;
      c.position.set(Math.cos(a) * pk * 0.7, 2.2 + Math.sin(i * 1.7) * 0.3 * pk, Math.sin(a) * pk * 0.7);
      c.scale.setScalar(pk > 0 && pk < 1 ? 0.3 * Math.sin(pk * Math.PI) : 0);
    });
    if (u > pStart + 0.9 && !done.current) {
      done.current = true;
      onDone();
    }
  });

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          <CreatureBody scene={scene} fit={fit} />
        </group>
        <Bubble text="MEHHH! 🤢" height={1.6} bubbleRef={bubble} />
      </group>
      <group ref={stars} position={[x, 0, z]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} geometry={star} material={STAR_MAT} scale={0} />
        ))}
      </group>
      <group ref={puffs} position={[x, 0, z]}>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} geometry={puffGeo} material={PUFF_MAT} scale={0} />
        ))}
      </group>
    </>
  );
}

function PenGoat({ x, z, i }: { x: number; z: number; i: number }) {
  const { scene, play, fit } = useCreature("G");
  const ring = useRef<THREE.Group>(null);
  const star = useStarGeometry();
  useEffect(() => {
    play(CLIPS.G.sit, { randomStart: true });
  }, [play]);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.y = clock.elapsedTime * 3 + i;
  });
  return (
    <group position={[x, 0, z]} rotation-y={0.5}>
      <CreatureBody scene={scene} fit={fit} />
      <group ref={ring} position-y={1.35}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} geometry={star} material={STAR_MAT} scale={0.09} position={[Math.cos((k / 3) * Math.PI * 2) * 0.35, 0, Math.sin((k / 3) * Math.PI * 2) * 0.35]} />
        ))}
      </group>
    </group>
  );
}

/** Captured goats sit dizzy in a corner of the clearing with stars circling their heads. */
export function CapturedPen({ count }: { count: number }) {
  return (
    <group>
      {PEN_SPOTS.slice(0, count).map(([x, z], i) => (
        <PenGoat key={i} x={x} z={z} i={i} />
      ))}
    </group>
  );
}

"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OBSTACLES } from "./Forest";
import { PEN_SPOTS, POINTS_3D, SPREAD, insideClearing } from "./layout";
import type { Pose, WalkStore } from "./walk";
import type { Cell } from "../aadu-puli/logic";

/** Eye heights: standing stays below the animals' heads, crouching looks a goat in the eye. */
export const EYE = { stand: 0.78, crouch: 0.42 };
const WALK = 3.1;
const SPRINT = 5.4;
const TURN = 1.9; // rad/s on the arrow keys
const LOOK = 0.0042; // rad per pixel dragged
const PITCH_MAX = THREE.MathUtils.degToRad(62);
/** How far a point may sit off the view axis and still count as aimed at, in radians. */
const AIM_CONE = THREE.MathUtils.degToRad(9);
const AIM_RANGE = 16;
const EDGE = 1.2; // keep this far inside the clearing

export type WalkApi = {
  /** Turn smoothly to face a board point. */
  lookAt: (index: number) => void;
  /** Tap whatever the crosshair is on. */
  interact: () => void;
  /** Jump back to a spot, facing as given. */
  teleport: (pose: Pose) => void;
};

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

/**
 * First-person walker. WASD / arrows move, drag (or pointer lock) looks around,
 * Shift sprints, C crouches, E / Space / Enter taps the aimed point. The camera
 * never rises above eye height, so you learn the position by walking round it.
 */
export function WalkRig({
  walk,
  apiRef,
  surface,
  board,
  captured,
  onAim,
  onTap,
}: {
  walk: WalkStore;
  apiRef: RefObject<WalkApi | null>;
  /** The element that receives drags and keys: the canvas wrapper. */
  surface: RefObject<HTMLDivElement | null>;
  board: Cell[];
  captured: number;
  onAim: (index: number | null) => void;
  onTap: (index: number) => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const keys = useRef(new Set<string>());
  const lookGoal = useRef<{ yaw: number; pitch: number } | null>(null);
  const aimed = useRef<number | null>(null);
  const latest = useRef({ board, captured, onTap, onAim });
  const eye = useRef(EYE.stand);
  const bob = useRef(0);

  useLayoutEffect(() => {
    latest.current = { board, captured, onTap, onAim };
  }, [board, captured, onTap, onAim]);

  // Step out of anything the spawn point happens to sit in.
  useLayoutEffect(() => {
    const [x, z] = resolve(walk.pose.x, walk.pose.z, latest.current.board, latest.current.captured);
    walk.set({ x, z });
  }, [walk]);

  useLayoutEffect(() => {
    apiRef.current = {
      lookAt: (index) => {
        const [x, z] = POINTS_3D[index];
        const p = walk.pose;
        const dx = x - p.x;
        const dz = z - p.z;
        lookGoal.current = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(0.3 - eye.current, Math.hypot(dx, dz)) };
      },
      interact: () => {
        if (aimed.current !== null) latest.current.onTap(aimed.current);
      },
      teleport: (pose) => {
        const [x, z] = resolve(pose.x, pose.z, latest.current.board, latest.current.captured);
        walk.set({ ...pose, x, z });
        lookGoal.current = null;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, walk]);

  // Keyboard, mouse drag, pointer lock.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["w", "a", "s", "d", "e", "c", "Shift", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      keys.current.add(k);
      if (k === "e" || k === " " || k === "Enter") apiRef.current?.interact();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current.delete(k);
    };
    const blur = () => keys.current.clear();

    const look = (dx: number, dy: number) => {
      const p = walk.pose;
      walk.set({ yaw: p.yaw - dx * LOOK, pitch: THREE.MathUtils.clamp(p.pitch - dy * LOOK, -PITCH_MAX, PITCH_MAX) });
      lookGoal.current = null;
    };
    // Drag anywhere on the canvas to look round (the stick lives in its own element and stops propagation).
    const drag = { id: -1, x: 0, y: 0 };
    const pdown = (e: PointerEvent) => {
      if (document.pointerLockElement === gl.domElement || e.button !== 0) return;
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const pmove = (e: PointerEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        look(e.movementX, e.movementY);
        return;
      }
      if (drag.id !== e.pointerId) return;
      look(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const pup = (e: PointerEvent) => {
      if (drag.id === e.pointerId) drag.id = -1;
    };
    // With the mouse locked, a click taps whatever the crosshair is on.
    const click = () => {
      if (document.pointerLockElement === gl.domElement) apiRef.current?.interact();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    el.addEventListener("pointerdown", pdown);
    window.addEventListener("pointermove", pmove);
    window.addEventListener("pointerup", pup);
    window.addEventListener("pointercancel", pup);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      el.removeEventListener("pointerdown", pdown);
      window.removeEventListener("pointermove", pmove);
      window.removeEventListener("pointerup", pup);
      window.removeEventListener("pointercancel", pup);
      document.removeEventListener("click", click);
    };
  }, [surface, gl, walk, apiRef]);

  const fwd = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const inp = walk.input;
    let { x, z, yaw, pitch } = walk.pose;

    // Turn with the arrow keys; or glide toward a requested point.
    const turn = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0);
    if (turn) {
      yaw += turn * TURN * dt;
      lookGoal.current = null;
    }
    const g = lookGoal.current;
    if (g) {
      const dy = THREE.MathUtils.euclideanModulo(g.yaw - yaw + Math.PI, Math.PI * 2) - Math.PI;
      yaw += dy * Math.min(1, dt * 7);
      pitch += (g.pitch - pitch) * Math.min(1, dt * 7);
      if (Math.abs(dy) < 0.01) lookGoal.current = null;
    }

    // Move in the direction we face, on the ground plane.
    const forward = (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0) + inp.stick.y;
    const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + inp.stick.x;
    const sprint = k.has("Shift") || inp.sprint;
    const crouch = k.has("c") || inp.crouch;
    const speed = (sprint ? SPRINT : WALK) * (crouch ? 0.6 : 1);
    const len = Math.hypot(forward, strafe);
    const moving = len > 0.05;
    if (moving) {
      const f = Math.min(1, len);
      const ang = yaw + Math.atan2(-strafe, forward);
      // yaw 0 looks down -Z, so forward is (-sin, -cos).
      [x, z] = resolve(x - Math.sin(ang) * speed * f * dt, z - Math.cos(ang) * speed * f * dt, latest.current.board, latest.current.captured);
      bob.current += dt * (sprint ? 13 : 9);
    }
    walk.set({ x, z, yaw, pitch, moving });

    // Eye height eases between standing and crouching; a little bob while walking.
    eye.current += ((crouch ? EYE.crouch : EYE.stand) - eye.current) * Math.min(1, dt * 8);
    const bobY = moving ? Math.sin(bob.current) * 0.018 : 0;
    camera.position.set(x, eye.current + bobY, z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");

    // Which board point is under the crosshair? An animal counts as hit anywhere on its
    // body (nearest body wins, so a tiger in your face beats a goat behind it); otherwise
    // the stone closest to the view axis within a small cone.
    const f = fwd.current;
    const d = dir.current;
    camera.getWorldDirection(f);
    let best: number | null = null;
    let bestAng = AIM_CONE;
    let hitDist = Infinity;
    const b = latest.current.board;
    for (let i = 0; i < POINTS_3D.length; i++) {
      const [px, pz] = POINTS_3D[i];
      const h = b[i] === "T" ? 0.55 : b[i] === "G" ? 0.5 : 0.15;
      d.set(px - camera.position.x, h - camera.position.y, pz - camera.position.z);
      const dist = d.length();
      if (dist > AIM_RANGE) continue;
      d.divideScalar(dist);
      const ang = Math.acos(THREE.MathUtils.clamp(f.dot(d), -1, 1));
      const bodyR = b[i] === "T" ? 0.95 : b[i] === "G" ? 0.5 : 0;
      if (bodyR && ang < Math.atan2(bodyR, dist) && dist < hitDist) {
        hitDist = dist;
        best = i;
      } else if (hitDist === Infinity && ang < bestAng) {
        bestAng = ang;
        best = i;
      }
    }
    if (best !== aimed.current) {
      aimed.current = best;
      latest.current.onAim(best);
    }
  });

  return null;
}

/** Push a step back out of anything solid: the clearing's edge, the animals, trees and rocks. */
function resolve(x: number, z: number, board: Cell[], captured: number): [number, number] {
  const push = (cx: number, cz: number, r: number) => {
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d >= r || d === 0) return;
    x = cx + (dx / d) * r;
    z = cz + (dz / d) * r;
  };
  board.forEach((c, i) => {
    if (c) push(POINTS_3D[i][0], POINTS_3D[i][1], c === "T" ? 1.8 : 1.0);
  });
  for (let i = 0; i < Math.min(captured, PEN_SPOTS.length); i++) push(PEN_SPOTS[i][0], PEN_SPOTS[i][1], 0.75);
  for (const o of OBSTACLES) push(o.x, o.z, o.r);
  if (!insideClearing(x, z, EDGE)) {
    // Slide back onto the ellipse.
    const rx = 9.2 * SPREAD - EDGE;
    const rz = 8.8 * SPREAD - EDGE;
    const a = Math.atan2(x / rx, z / rz);
    x = Math.sin(a) * rx * 0.999;
    z = Math.cos(a) * rz * 0.999;
  }
  return [x, z];
}

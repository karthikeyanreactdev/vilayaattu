"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { STONE_TOP } from "./layout";

export type Kind = "T" | "G";

const URLS: Record<Kind, string> = {
  T: "/models/aadu-puli/tiger-animated.glb",
  G: "/models/aadu-puli/goat-animated.glb",
};
useGLTF.preload(URLS.T);
useGLTF.preload(URLS.G);

/** The model's own animation clips, by what we use them for. */
export const CLIPS = {
  T: { idle: "Armature|Curious", walk: "Armature|Walking", attack: "Armature|Attack jump" },
  G: { idle: "Idle_Stage2_Lupe_0-30", nervous: "Idle_Stage3_Lupe_0-180", hop: "Match_Lupe_0-19", happy: "Target_Complete_Lupe", caught: "Menu_Vomit_Lupe", sit: "Idle_Stage1_Lupe" },
} as const;

/** Board size of each animal, and the turn that points its nose down +Z. */
const FIT: Record<Kind, { size: number; axis: "length" | "height"; facing: number }> = {
  T: { size: 2.0, axis: "length", facing: 0 },
  G: { size: 1.05, axis: "height", facing: -Math.PI / 2 },
};

type Prepared = { scale: number; offset: THREE.Vector3; facing: number; clips: THREE.AnimationClip[] };
const prepared = new WeakMap<object, Prepared>();

/** Bones hanging straight off the tiger's root: hips/spine, head and both hind legs. */
const TIGER_ROOT_BONES = ["Bone_01", "Bone002_017", "Bone015_020", "Bone022_026"];

/** Linear sample of a 3-component track at a time. */
function sampleVec3(track: THREE.KeyframeTrack, time: number) {
  const { times, values } = track;
  let i = 0;
  while (i < times.length - 1 && times[i + 1] < time) i++;
  const j = Math.min(i + 1, times.length - 1);
  const u = j === i ? 0 : THREE.MathUtils.clamp((time - times[i]) / (times[j] - times[i]), 0, 1);
  return [0, 1, 2].map((k) => values[i * 3 + k] + (values[j * 3 + k] - values[i * 3 + k]) * u);
}

/**
 * The attack jump carries the tiger forward on its own; the board drives that leap instead.
 * Take the hips' travel out of every root bone together so the body keeps its shape.
 */
function inPlace(clip: THREE.AnimationClip) {
  const hips = clip.tracks.find((t) => t.name === "Bone_01.position");
  if (!hips) return clip;
  const start = sampleVec3(hips, hips.times[0]);
  const tracks = clip.tracks.map((t) => {
    const bone = t.name.slice(0, t.name.lastIndexOf("."));
    if (!t.name.endsWith(".position") || !TIGER_ROOT_BONES.includes(bone)) return t;
    const values = Float32Array.from(t.values);
    t.times.forEach((time, i) => {
      const at = sampleVec3(hips, time);
      for (let k = 0; k < 3; k++) values[i * 3 + k] -= at[k] - start[k];
    });
    return new THREE.VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(values));
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Measure and tidy a loaded model once: fit it to the board and light it like the scene. */
function prepare(kind: Kind, gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): Prepared {
  const hit = prepared.get(gltf);
  if (hit) return hit;
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    // The tiger ships unlit; give it a lit material so it sits in the scene's light and shadow.
    const mat = m.material as THREE.MeshBasicMaterial;
    if (mat.type === "MeshBasicMaterial") m.material = new THREE.MeshStandardMaterial({ map: mat.map, roughness: 0.85 });
    if (m.isSkinnedMesh) m.skeleton.update();
    m.computeBoundingBox();
    box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  const size = box.getSize(new THREE.Vector3());
  const fit = FIT[kind];
  const scale = fit.size / (fit.axis === "height" ? size.y : Math.max(size.x, size.z));
  const center = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(-center.x * scale, STONE_TOP - box.min.y * scale, -center.z * scale);
  const clips = gltf.animations.map((c) => (c.name === CLIPS.T.attack ? inPlace(c) : c));
  const p = { scale, offset, facing: fit.facing, clips };
  prepared.set(gltf, p);
  return p;
}

export type PlayOptions = { once?: boolean; fade?: number; speed?: number; randomStart?: boolean };

/** A private, animated copy of the tiger or goat. */
export function useCreature(kind: Kind) {
  const gltf = useGLTF(URLS[kind]);
  const fit = prepare(kind, gltf);
  const scene = useMemo(() => {
    const s = SkeletonUtils.clone(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false; // skinned poses move outside the bind-pose bounds
    });
    return s;
  }, [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const current = useRef<THREE.AnimationAction | null>(null);

  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  /** Cross-fade to a clip; returns how long it runs, in seconds. */
  const play = useCallback(
    (name: string, opts: PlayOptions = {}) => {
      const clip = fit.clips.find((c) => c.name === name);
      if (!clip) return 0;
      const speed = opts.speed ?? 1;
      const next = mixer.clipAction(clip);
      if (current.current === next && !opts.once) {
        next.timeScale = speed;
        return clip.duration / speed;
      }
      next.reset();
      next.timeScale = speed;
      next.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = !!opts.once;
      if (opts.randomStart) next.time = Math.random() * clip.duration;
      next.play();
      if (current.current && current.current !== next) current.current.crossFadeTo(next, opts.fade ?? 0.25, false);
      current.current = next;
      return clip.duration / speed;
    },
    [mixer, fit],
  );

  return { scene, play, fit };
}

/** Places the model so it stands on the stone, centred, nose down +Z. */
export function CreatureBody({ scene, fit }: { scene: THREE.Object3D; fit: Prepared }) {
  return (
    <group rotation-y={fit.facing}>
      <group scale={fit.scale} position={fit.offset}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

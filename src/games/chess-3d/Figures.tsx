"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/*
 * Brick figures modelled in Blender (design/blender/build_figures.py), one per
 * piece and side, all in one file as Fig_<piece>_<side>. They face +Z, stand on
 * their base at y = 0, and carry named joints the animation code moves:
 * body, legL/legR, armL/armR, head, cape for people; legFL/legFR/legBL/legBR,
 * neck, tail, trunk0-3, earL/earR, rider for animals.
 */

const URL = "/models/chess/royal-chess-figures.glb";
useGLTF.preload(URL);

export type PieceType = "k" | "q" | "b" | "n" | "r" | "p";
export type Side = "w" | "b";

/** Figures are modelled about 1 unit tall, then grown to fill their square. */
export const FIGURE_SCALE = 1.3;

/** A private copy of the figure for one chess piece, so it can be posed and broken apart on its own. */
export function Figure({ type, side }: { type: PieceType; side: Side }) {
  const { scenes } = useGLTF(URL);
  const figure = useMemo(() => {
    // Each figure sits in its own scene of the file.
    const name = `Fig_${type}_${side}`;
    const source = scenes.map((s) => s.getObjectByName(name)).find(Boolean);
    if (!source) throw new Error(`Missing chess figure ${name}`);
    const copy = source.clone(true);
    copy.position.set(0, 0, 0);
    copy.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return copy;
  }, [scenes, type, side]);
  return (
    <group scale={FIGURE_SCALE}>
      <primitive object={figure} />
    </group>
  );
}

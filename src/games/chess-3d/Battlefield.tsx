"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The carved royal board on its dais, with a war camp behind each army.
 * Modelled in Blender (design/royal-chess.blend): squares are 1 unit, the board
 * top is at y = 0, and White's camp is at +Z.
 */
const URL = "/models/chess/royal-chess-scene.glb";
useGLTF.preload(URL);

export function Battlefield() {
  const { scene } = useGLTF(URL);
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.receiveShadow = true;
      m.castShadow = true;
    });
  }, [scene]);
  return <primitive object={scene} />;
}

/** Soft studio reflections so the gold and the lacquered squares shine; no download needed. */
export function Reflections() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

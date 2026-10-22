"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SPREAD } from "./layout";

/** Buttons outside the canvas drive the camera through this. */
export type ViewApi = {
  rotate: (dir: 1 | -1) => void;
  zoom: (dir: 1 | -1) => void;
  reset: () => void;
};

const TARGET = new THREE.Vector3(0, 0, 0);
const ELEVATION = THREE.MathUtils.degToRad(52);

/** Drag to orbit, pinch or scroll to zoom; starts framed so the whole board fits. */
export function ViewRig({ apiRef }: { apiRef: RefObject<ViewApi | null> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useRef<OrbitControlsImpl>(null);
  // Smooth moves for the buttons: where the camera is heading, in spherical coords.
  const goal = useRef<THREE.Spherical | null>(null);

  // Distance at which the whole board fits this canvas shape.
  const fit = useMemo(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max((8.4 * SPREAD) / (tan * (size.width / size.height)), (7.6 * SPREAD) / tan);
  }, [camera, size]);

  const home = useCallback(() => new THREE.Spherical(fit, Math.PI / 2 - ELEVATION, 0), [fit]);

  useLayoutEffect(() => {
    const s = home();
    camera.position.setFromSpherical(s).add(TARGET);
    camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
    controls.current?.update();
  }, [camera, home]);

  useLayoutEffect(() => {
    const current = () => new THREE.Spherical().setFromVector3(camera.position.clone().sub(TARGET));
    apiRef.current = {
      rotate: (dir) => {
        const s = goal.current ?? current();
        goal.current = new THREE.Spherical(s.radius, s.phi, s.theta + dir * (Math.PI / 6));
      },
      zoom: (dir) => {
        const s = goal.current ?? current();
        const r = THREE.MathUtils.clamp(s.radius * (dir > 0 ? 0.8 : 1.25), fit * 0.4, fit * 1.4);
        goal.current = new THREE.Spherical(r, s.phi, s.theta);
      },
      reset: () => {
        goal.current = home();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, home, fit]);

  useFrame(() => {
    const g = goal.current;
    if (!g) return;
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(TARGET));
    s.radius += (g.radius - s.radius) * 0.15;
    s.phi += (g.phi - s.phi) * 0.15;
    // Short way round, even across the ±180° seam.
    const dTheta = THREE.MathUtils.euclideanModulo(g.theta - s.theta + Math.PI, Math.PI * 2) - Math.PI;
    s.theta += dTheta * 0.15;
    camera.position.setFromSpherical(s).add(TARGET);
    camera.lookAt(TARGET);
    controls.current?.update();
    if (Math.abs(g.radius - s.radius) < 0.01 && Math.abs(dTheta) < 0.002 && Math.abs(g.phi - s.phi) < 0.002) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.6}
      minDistance={fit * 0.4}
      maxDistance={fit * 1.4}
      minPolarAngle={0.12}
      maxPolarAngle={1.32}
      onStart={() => (goal.current = null)}
    />
  );
}

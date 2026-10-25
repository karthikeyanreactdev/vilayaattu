"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { AaduPuliState } from "../aadu-puli/logic";
import { Forest } from "./Forest";
import { POINTS_3D, STONE_TOP } from "./layout";
import { FLASH } from "./Minimap";
import { allMoods } from "./moods";
import { CapturedPen, DyingGoat, Piece } from "./Pieces";
import { useRecent, type WalkStore } from "./walk";
import { WalkRig, type WalkApi } from "./WalkRig";

/**
 * A glowing marker you can spot from ground level: a pulsing ring on the stone
 * and a soft pillar of light above it (flat rings vanish when seen edge-on).
 */
function Beacon({ x, z, color, radius, pulse, height = 1.4, strength = 1 }: { x: number; z: number; color: string; radius: number; pulse: number; height?: number; strength?: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * pulse) * 0.12;
    ring.current?.scale.set(s, s, 1);
    const m = pillar.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = (0.16 + Math.sin(clock.elapsedTime * pulse) * 0.06) * strength;
  });
  return (
    <group position={[x, STONE_TOP, z]}>
      <mesh ref={ring} position-y={0.03} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[radius, 0.05, 8, 40]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      <mesh ref={pillar} position-y={height / 2}>
        <cylinderGeometry args={[radius * 0.55, radius * 0.9, height, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Gold trail along the latest move, fading out over a few seconds. */
function MoveTrail({ from, to, at }: { from: number; to: number; at: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [ax, az] = POINTS_3D[from];
  const [bx, bz] = POINTS_3D[to];
  useFrame(() => {
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!m) return;
    const age = (performance.now() - at) / 1000;
    m.opacity = Math.max(0, 0.7 * (1 - age / FLASH));
  });
  return (
    <mesh ref={ref} position={[(ax + bx) / 2, STONE_TOP + 0.05, (az + bz) / 2]} rotation-y={-Math.atan2(bz - az, bx - ax)}>
      <boxGeometry args={[Math.hypot(bx - ax, bz - az), 0.02, 0.28]} />
      <meshBasicMaterial color="#facc15" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}

type Ghost = { id: string; index: number };

export default function AaduPuliScene({
  state,
  selected,
  targets,
  movable,
  aimed,
  onAim,
  onTap,
  walk,
  walkApi,
  surface,
  flashAt,
}: {
  state: AaduPuliState;
  selected: number | null;
  targets: Map<number, boolean>;
  movable: Set<number>;
  aimed: number | null;
  onAim: (index: number | null) => void;
  onTap: (index: number) => void;
  walk: WalkStore;
  walkApi: RefObject<WalkApi | null>;
  surface: RefObject<HTMLDivElement | null>;
  flashAt: number;
}) {
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prev = useRef(state);
  const moods = useMemo(() => allMoods(state.board), [state.board]);
  const fresh = useRecent(flashAt, FLASH * 1000);

  // Keep the captured goat on screen long enough for its funny exit.
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (state.moveNo === before.moveNo) return;
    const cap = state.lastMove?.captured;
    if (cap === null || cap === undefined) return;
    const id = before.pieceIds[cap];
    if (id) setGhosts((g) => [...g, { id, index: cap }]);
  }, [state]);

  const lm = state.lastMove;
  // Captured goats wait in the pen until their exit animation is over.
  const penCount = Math.max(0, state.captured - ghosts.length);

  return (
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ fov: 68, near: 0.08, far: 120 }} gl={{ antialias: true }} className="touch-none">
      <WalkRig walk={walk} apiRef={walkApi} surface={surface} board={state.board} captured={state.captured} onAim={onAim} onTap={onTap} />
      <color attach="background" args={["#a9c9e0"]} />
      <fog attach="fog" args={["#a9c9e0", 30, 70]} />
      <hemisphereLight args={["#d6e8f7", "#3a5a24", 1.1]} />
      <directionalLight
        position={[-13, 24, 12]}
        intensity={2.4}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-21}
        shadow-camera-right={21}
        shadow-camera-top={21}
        shadow-camera-bottom={-21}
        shadow-bias={-0.0005}
      />

      <Forest />

      {POINTS_3D.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, 0.3, z]} onClick={(e) => (e.stopPropagation(), e.delta < 8 && onTap(i))}>
            <cylinderGeometry args={[0.75, 0.75, 0.6, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {targets.has(i) && <Beacon x={x} z={z} radius={0.55} pulse={5} color={targets.get(i) ? "#ef4444" : "#facc15"} />}
          {movable.has(i) && selected !== i && <Beacon x={x} z={z} radius={0.65} pulse={3} color="#fde68a" height={0.9} strength={0.6} />}
          {selected === i && <Beacon x={x} z={z} radius={0.65} pulse={8} color="#facc15" />}
          {aimed === i && !state.board[i] && <Beacon x={x} z={z} radius={0.4} pulse={6} color="#ffffff" height={0.6} strength={0.5} />}
        </group>
      ))}

      {fresh && lm && <Beacon x={POINTS_3D[lm.to][0]} z={POINTS_3D[lm.to][1]} radius={0.9} pulse={2.5} color="#facc15" height={3.2} strength={0.9} />}
      {fresh && lm && lm.from !== null && <MoveTrail from={lm.from} to={lm.to} at={flashAt} />}

      <Suspense fallback={null}>
        {state.pieceIds.map((id, i) =>
          id && state.board[i] ? (
            <Piece
              key={id}
              kind={state.board[i] as "T" | "G"}
              index={i}
              moveNo={state.moveNo}
              captureMove={lm?.to === i && lm.captured !== null}
              selected={selected === i}
              mood={moods[i]}
              focused={aimed === i}
              onTap={onTap}
            />
          ) : null,
        )}
        {ghosts.map((g) => (
          <DyingGoat key={g.id} index={g.index} onDone={() => setGhosts((gs) => gs.filter((x) => x.id !== g.id))} />
        ))}
        <CapturedPen count={penCount} />
      </Suspense>
    </Canvas>
  );
}

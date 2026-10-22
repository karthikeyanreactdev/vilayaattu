"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ADJ } from "../aadu-puli/board";
import type { AaduPuliState } from "../aadu-puli/logic";
import { Forest } from "./Forest";
import { POINTS_3D, STONE_TOP } from "./layout";
import { CapturedPen, DyingGoat, Piece } from "./Pieces";
import { ViewRig, type ViewApi } from "./ViewRig";

/** Pulsing ring on a point: where to move (gold), a capture (red) or a piece you can pick. */
function Ring({ x, z, color, radius, pulse }: { x: number; z: number; color: string; radius: number; pulse: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * pulse) * 0.12;
    ref.current?.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} position={[x, STONE_TOP + 0.03, z]} rotation-x={-Math.PI / 2}>
      <torusGeometry args={[radius, 0.05, 8, 40]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
    </mesh>
  );
}

type Ghost = { id: string; index: number };

export default function AaduPuliScene({
  state,
  selected,
  targets,
  movable,
  onTap,
  viewApi,
}: {
  state: AaduPuliState;
  selected: number | null;
  targets: Map<number, boolean>;
  movable: Set<number>;
  onTap: (index: number) => void;
  viewApi: RefObject<ViewApi | null>;
}) {
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const prev = useRef(state);

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
  const nearTiger = (i: number) => ADJ[i].some((n) => state.board[n] === "T");
  // Captured goats wait in the pen until their exit animation is over.
  const penCount = Math.max(0, state.captured - ghosts.length);

  return (
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ fov: 38, near: 0.5, far: 120 }} gl={{ antialias: true }} className="touch-manipulation">
      <ViewRig apiRef={viewApi} />
      <color attach="background" args={["#a9c9e0"]} />
      <fog attach="fog" args={["#a9c9e0", 42, 84]} />
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
          {targets.has(i) && <Ring x={x} z={z} radius={0.55} pulse={5} color={targets.get(i) ? "#ef4444" : "#facc15"} />}
          {movable.has(i) && selected !== i && <Ring x={x} z={z} radius={0.65} pulse={3} color="#fde68a" />}
          {selected === i && <Ring x={x} z={z} radius={0.65} pulse={8} color="#facc15" />}
        </group>
      ))}

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
              nervous={state.board[i] === "G" && nearTiger(i)}
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

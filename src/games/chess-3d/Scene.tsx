"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Chess } from "chess.js";
import { Suspense, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { ChessState } from "../chess/logic";
import type { ChessBoardView } from "../chess/Shell";
import { ViewRig, type ViewApi } from "../three/ViewRig";
import { Actor, Fallen, type Plan } from "./Actors";
import type { PieceType, Side } from "./Figures";
import { SQUARES, squarePos } from "./layout";
import { Battlefield, Reflections } from "./Battlefield";

/** Flat glow on a square: last move, selection, or a king in danger. */
function Tint({ sq, color, opacity, pulse = 0 }: { sq: string; color: string; opacity: number; pulse?: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current && pulse) ref.current.opacity = opacity * (0.6 + 0.4 * Math.sin(clock.elapsedTime * pulse));
  });
  const [x, z] = squarePos(sq);
  return (
    <mesh position={[x, 0.004, z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[0.98, 0.98]} />
      <meshBasicMaterial ref={ref} color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** Where the selected piece may go: gold dots on empty squares, red rings on enemies. */
function Target({ sq, capture }: { sq: string; capture: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.1;
    ref.current?.scale.set(s, s, 1);
  });
  const [x, z] = squarePos(sq);
  return (
    <mesh ref={ref} position={[x, 0.012, z]} rotation-x={-Math.PI / 2}>
      {capture ? <torusGeometry args={[0.42, 0.04, 8, 40]} /> : <circleGeometry args={[0.13, 24]} />}
      <meshStandardMaterial color={capture ? "#ef4444" : "#facc15"} emissive={capture ? "#ef4444" : "#facc15"} emissiveIntensity={0.7} />
    </mesh>
  );
}

export default function ChessScene({ state, view, viewApi }: { state: ChessState; view: ChessBoardView; viewApi: RefObject<ViewApi | null> }) {
  const { chess, flipped, selected, targets, kingSq, tapSquare } = view;
  const planRef = useRef<Plan | null>(null);
  const prev = useRef(state);
  const [ghosts, setGhosts] = useState<Plan[]>([]);

  // Turn each new move into a little play for the figures to act out.
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = state;
    const lm = state.lastMove;
    if (state.moveNo === before.moveNo || !lm) return;
    const moverId = before.ids[lm.from];
    if (!moverId) return;
    const was = new Chess(before.fen);
    const mover = was.get(lm.from as never);
    if (!mover) return;
    const still = new Set(Object.values(state.ids));
    const gone = Object.entries(before.ids).find(([, id]) => !still.has(id));
    const lost = gone ? was.get(gone[0] as never) : undefined;
    const plan: Plan = {
      moveNo: state.moveNo,
      moverId,
      moverType: mover.type as PieceType,
      from: squarePos(lm.from),
      to: squarePos(lm.to),
      victim: gone && lost ? { id: gone[1], type: lost.type as PieceType, side: lost.color as Side, at: squarePos(gone[0]) } : null,
      start: null,
    };
    planRef.current = plan;
    if (plan.victim) setGhosts((g) => [...g, plan]);
  }, [state]);

  const mated = state.status === "finished" && chess.isCheckmate();
  const loser = chess.turn();

  return (
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ fov: 36, near: 0.8, far: 400 }} gl={{ antialias: true }} className="touch-manipulation">
      <ViewRig apiRef={viewApi} halfWidth={5.2 / 1.3} halfDepth={4.6 / 1.3} elevation={40} azimuth={flipped ? Math.PI : 0} />
      <color attach="background" args={["#e3c193"]} />
      <fog attach="fog" args={["#ddb98a", 45, 170]} />
      <Reflections />
      <hemisphereLight args={["#ffe6c7", "#6b4a2a", 1.2]} />
      <directionalLight
        position={[7, 13, 9]}
        intensity={2.6}
        color="#ffd9a8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[-6, 6, -5]} intensity={0.6} color="#a8c0ff" />
      {/* Soft front lights for both armies, so the black figures read too. */}
      <directionalLight position={[0, 5, 12]} intensity={0.9} color="#fff1dc" />
      <directionalLight position={[0, 5, -12]} intensity={0.9} color="#fff1dc" />

      <Suspense fallback={null}>
        <Battlefield />
      </Suspense>

      {state.lastMove && <Tint sq={state.lastMove.from} color="#f5c04a" opacity={0.35} />}
      {state.lastMove && <Tint sq={state.lastMove.to} color="#f5c04a" opacity={0.45} />}
      {selected && <Tint sq={selected} color="#34d399" opacity={0.55} />}
      {kingSq && <Tint sq={kingSq} color="#ef4444" opacity={0.7} pulse={6} />}
      {targets.map((sq) => (
        <Target key={sq} sq={sq} capture={Boolean(chess.get(sq as never))} />
      ))}

      {/* Tap areas: flat on each square, so a nearer square never steals the tap. Figures take taps for their own square. */}
      {SQUARES.map((sq) => {
        const [x, z] = squarePos(sq);
        return (
          <mesh key={sq} position={[x, 0.01, z]} rotation-x={-Math.PI / 2} onClick={(e) => (e.stopPropagation(), e.delta < 8 && tapSquare(sq))}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}

      <Suspense fallback={null}>
        {Object.entries(state.ids).map(([sq, id]) => {
          const piece = chess.get(sq as never);
          if (!piece) return null;
          const side = piece.color as Side;
          return (
            <Actor
              key={id}
              id={id}
              type={piece.type as PieceType}
              side={side}
              at={squarePos(sq)}
              planRef={planRef}
              selected={selected === sq}
              inCheck={kingSq === sq}
              fallen={mated && piece.type === "k" && side === loser}
              cheering={mated && side !== loser}
              onPick={() => tapSquare(sq)}
            />
          );
        })}
        {ghosts.map((plan) => (
          <Fallen key={`${plan.moveNo}-${plan.victim!.id}`} plan={plan} onDone={() => setGhosts((g) => g.filter((p) => p !== plan))} />
        ))}
      </Suspense>
    </Canvas>
  );
}

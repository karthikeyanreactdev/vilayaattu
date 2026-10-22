"use client";

import { AnimatePresence, motion } from "motion/react";
import { Box, Square as SquareIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { GameBoardProps } from "../types";
import type { ChessAction, ChessState } from "./logic";
import { ChessPiece, type PieceColor, type PieceType } from "./Pieces";
import { ChessShell, type ChessBoardView } from "./Shell";

const FILES = "abcdefgh";

function FlatBoard({ state, view, tilt }: { state: ChessState; view: ChessBoardView; tilt: boolean }) {
  const { chess, flipped, selected, targets, kingSq, tapSquare } = view;

  const pos = (sq: string) => {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return flipped ? { col: 7 - f, row: r } : { col: f, row: 7 - r };
  };

  const squares: { sq: string; col: number; row: number; light: boolean }[] = [];
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const sq = `${FILES[f]}${r + 1}`;
      const p = pos(sq);
      squares.push({ sq, ...p, light: (f + r) % 2 === 1 });
    }

  return (
    <div className="[perspective:1100px]">
      <motion.div
        animate={{ rotateX: tilt ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="relative mx-auto aspect-square w-full origin-bottom rounded-xl border-[10px] border-[oklch(0.35_0.06_50)] shadow-2xl [transform-style:preserve-3d]"
        style={{ maxWidth: "min(92vw, 560px)" }}
      >
        {squares.map(({ sq, col, row, light }) => {
          const isLast = state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq);
          const isTarget = targets.includes(sq);
          const occupied = Boolean(chess.get(sq as never));
          return (
            <button
              key={sq}
              type="button"
              onClick={() => tapSquare(sq)}
              className="absolute"
              style={{
                left: `${col * 12.5}%`,
                top: `${row * 12.5}%`,
                width: "12.5%",
                height: "12.5%",
                background: light ? COLORS.CHESS.light : COLORS.CHESS.dark,
              }}
              aria-label={sq}
            >
              {isLast && <span className="absolute inset-0" style={{ background: COLORS.CHESS.highlight }} />}
              {selected === sq && <span className="absolute inset-0 bg-emerald-400/50" />}
              {kingSq === sq && (
                <motion.span
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(circle, ${COLORS.CHESS.check}, transparent 70%)` }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              {isTarget && (
                <span
                  className={cn("absolute rounded-full", occupied ? "inset-0.5 border-[5px]" : "inset-[36%]")}
                  style={occupied ? { borderColor: COLORS.CHESS.hint } : { background: COLORS.CHESS.hint }}
                />
              )}
              {col === 0 && (
                <span className={cn("absolute top-0.5 left-0.5 text-[9px] font-bold", light ? "text-[#b58863]" : "text-[#f0d9b5]")}>{sq[1]}</span>
              )}
              {row === 7 && (
                <span className={cn("absolute right-0.5 bottom-0 text-[9px] font-bold", light ? "text-[#b58863]" : "text-[#f0d9b5]")}>{sq[0]}</span>
              )}
            </button>
          );
        })}

        <AnimatePresence>
          {Object.entries(state.ids).map(([sq, id]) => {
            const piece = chess.get(sq as never) as { type: PieceType; color: PieceColor } | undefined;
            if (!piece) return null;
            const { col, row } = pos(sq);
            return (
              <motion.div
                key={id}
                className="pointer-events-none absolute"
                style={{ width: "12.5%", height: "12.5%", zIndex: 10 + row }}
                initial={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, opacity: 0, scale: 0.5 }}
                animate={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, opacity: 1, scale: selected === sq ? 1.12 : 1 }}
                exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.25 } }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <motion.div
                  className="size-full origin-bottom"
                  animate={{ rotateX: tilt ? -24 : 0, y: tilt ? "-18%" : "0%" }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                >
                  <ChessPiece type={piece.type} color={piece.color} className="size-full drop-shadow-[0_4px_3px_rgba(0,0,0,0.45)]" />
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function ChessBoard(props: GameBoardProps<ChessState, ChessAction>) {
  const [tilt, setTilt] = useState(true);
  return (
    <ChessShell
      props={props}
      board={(view) => <FlatBoard state={props.state} view={view} tilt={tilt} />}
      actions={
        <Button variant="outline" size="sm" onClick={() => setTilt((t) => !t)} aria-pressed={tilt}>
          {tilt ? <SquareIcon /> : <Box />} {tilt ? "Flat view" : "3D view"}
        </Button>
      }
    />
  );
}

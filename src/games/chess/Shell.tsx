"use client";

import { AnimatePresence, motion } from "motion/react";
import { Flag, Handshake } from "lucide-react";
import { Chess } from "chess.js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useNow } from "@/hooks/useNow";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import type { GameBoardProps, PlayerRef } from "../types";
import { isPromotion, legalTargets, type ChessAction, type ChessState } from "./logic";
import { ChessPiece, PieceDefs, type PieceColor, type PieceType } from "./Pieces";

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PlayerBar({ player, color, ms, running, captured, advantage, isMe }: {
  player: PlayerRef;
  color: PieceColor;
  ms: number | null;
  running: boolean;
  captured: PieceType[];
  advantage: number;
  isMe: boolean;
}) {
  const low = ms !== null && ms < 20_000;
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar avatar={player.avatar} seat={player.seat} size="sm" active={running} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {player.name}
          {isMe && <span className="text-muted-foreground"> (you)</span>}
        </p>
        <div className="flex h-5 items-center">
          {captured.map((t, i) => (
            <ChessPiece key={i} type={t} color={color === "w" ? "b" : "w"} className="-mr-1.5 size-5" />
          ))}
          {advantage > 0 && <span className="ml-2 text-xs text-muted-foreground">+{advantage}</span>}
        </div>
      </div>
      {ms !== null && (
        <motion.div
          animate={running && low ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1, repeat: running && low ? Infinity : 0 }}
          className={cn(
            "rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums transition-colors",
            running ? (low ? "bg-destructive text-white" : "bg-foreground text-background") : "bg-muted text-muted-foreground",
          )}
        >
          {fmt(ms)}
        </motion.div>
      )}
    </div>
  );
}

/** Everything a board drawing needs to show the position and take taps. */
export type ChessBoardView = {
  chess: Chess;
  myColor: PieceColor | null;
  /** Black's view: rank 8 nearest the player. */
  flipped: boolean;
  selected: string | null;
  targets: string[];
  /** Square of the king in check, if any. */
  kingSq: string | undefined;
  tapSquare: (sq: string) => void;
};

/**
 * Player bars, clocks, draw/resign, move list and promotion picker around any
 * board drawing. The 2D and 3D chess boards both sit inside it.
 */
export function ChessShell({
  props: { state, me, players, send, clockOffset },
  board,
  actions,
  className,
}: {
  props: GameBoardProps<ChessState, ChessAction>;
  board: (view: ChessBoardView) => ReactNode;
  /** Extra buttons next to draw/resign. */
  actions?: ReactNode;
  className?: string;
}) {
  const play = useSound();
  const myColor: PieceColor | null = me === state.white ? "w" : me === state.black ? "b" : null;
  const flipped = myColor === "b";
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const lastMoveNo = useRef(state.moveNo);

  const chess = useMemo(() => new Chess(state.fen), [state.fen]);
  const turn = chess.turn();
  const myTurn = myColor === turn && state.status === "playing";
  const inCheck = chess.inCheck();
  const targets = useMemo(() => (selected ? legalTargets(state.fen, selected) : []), [selected, state.fen]);

  // Sound + clear selection on every new move.
  useEffect(() => {
    if (state.moveNo === lastMoveNo.current) return;
    lastMoveNo.current = state.moveNo;
    setSelected(null);
    if (!state.lastMove) return;
    if (chess.inCheck()) play("turn", [40, 30, 40]);
    else play(state.lastMove.captured ? "capture" : "move", 15);
  }, [state.moveNo, state.lastMove, chess, play]);

  const now = useNow(Boolean(state.clock) && state.status === "playing", 250);
  const clockFor = (c: PieceColor) => {
    if (!state.clock) return null;
    const base = c === "w" ? state.clock.white : state.clock.black;
    if (state.status !== "playing" || c !== turn || state.history.length === 0) return base;
    return base - (now + clockOffset - state.clock.turnStartedAt);
  };

  // Captured material per side.
  const { capturedBy, adv } = useMemo(() => {
    const counts: Record<PieceColor, Record<string, number>> = { w: {}, b: {} };
    for (const row of chess.board()) for (const cell of row) if (cell) counts[cell.color][cell.type] = (counts[cell.color][cell.type] ?? 0) + 1;
    const lost = (c: PieceColor) =>
      (Object.keys(START) as PieceType[]).flatMap((t) => Array(Math.max(0, START[t] - (counts[c][t] ?? 0))).fill(t) as PieceType[]);
    const material = (c: PieceColor) => Object.entries(counts[c]).reduce((s, [t, n]) => s + VALUES[t] * n, 0);
    return {
      capturedBy: { w: lost("b"), b: lost("w") },
      adv: { w: material("w") - material("b"), b: material("b") - material("w") },
    };
  }, [chess]);

  const tapSquare = (sq: string) => {
    if (!myTurn) return;
    const piece = chess.get(sq as never);
    if (selected && targets.includes(sq)) {
      if (isPromotion(state.fen, selected, sq)) {
        setPromo({ from: selected, to: sq });
        return;
      }
      send({ type: "move", from: selected, to: sq });
      setSelected(null);
      return;
    }
    if (piece && piece.color === myColor) {
      play("select");
      setSelected(sq === selected ? null : sq);
    } else {
      setSelected(null);
    }
  };

  const white = players.find((p) => p.id === state.white)!;
  const black = players.find((p) => p.id === state.black)!;
  const top = flipped ? white : black;
  const bottom = flipped ? black : white;
  const topColor: PieceColor = flipped ? "w" : "b";
  const bottomColor: PieceColor = flipped ? "b" : "w";
  const kingSq = inCheck
    ? chess.board().flat().find((c) => c && c.type === "k" && c.color === turn)?.square
    : undefined;

  return (
    <div className={cn("mx-auto grid w-full max-w-xl gap-3 p-3 pb-24 sm:p-4", className)}>
      <PieceDefs />
      <PlayerBar
        player={top}
        color={topColor}
        ms={clockFor(topColor)}
        running={turn === topColor && state.status === "playing"}
        captured={capturedBy[topColor]}
        advantage={adv[topColor]}
        isMe={top.id === me}
      />

      {board({ chess, myColor, flipped, selected, targets, kingSq, tapSquare })}

      <PlayerBar
        player={bottom}
        color={bottomColor}
        ms={clockFor(bottomColor)}
        running={turn === bottomColor && state.status === "playing"}
        captured={capturedBy[bottomColor]}
        advantage={adv[bottomColor]}
        isMe={bottom.id === me}
      />

      <AnimatePresence>
        {state.drawOffer && state.status === "playing" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
          >
            <Handshake className="size-4 text-primary" />
            <span className="flex-1">
              {state.drawOffer === me ? "You offered a draw…" : `${players.find((p) => p.id === state.drawOffer)?.name} offers a draw`}
            </span>
            {state.drawOffer !== me && myColor && (
              <>
                <Button size="sm" onClick={() => send({ type: "accept-draw" })}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => send({ type: "decline-draw" })}>
                  Decline
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {myColor && state.status === "playing" && (
          <>
            <Button variant="outline" size="sm" disabled={Boolean(state.drawOffer)} onClick={() => send({ type: "offer-draw" })}>
              <Handshake /> Offer draw
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmResign(true)}>
              <Flag /> Resign
            </Button>
          </>
        )}
        <span className={cn("ml-auto text-sm font-semibold", myTurn ? "text-primary" : "text-muted-foreground")}>
          {state.status === "finished" ? "Game over" : inCheck ? (myTurn ? "Check! Protect your king" : "Check!") : myTurn ? "Your move" : `${turn === "w" ? "White" : "Black"} to move`}
        </span>
      </div>

      {state.history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-muted/50 p-2 font-mono text-xs">
          {state.history.map((san, i) => (
            <span key={i} className={cn("shrink-0 rounded px-1.5 py-0.5", i === state.history.length - 1 && "bg-primary text-primary-foreground")}>
              {i % 2 === 0 && <span className="mr-1 text-muted-foreground">{i / 2 + 1}.</span>}
              {san}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {promo && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPromo(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="rounded-2xl bg-popover p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-center font-semibold">Promote to</p>
              <div className="flex gap-2">
                {(["q", "r", "b", "n"] as const).map((t) => (
                  <motion.button
                    key={t}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    className="size-16 rounded-xl bg-muted p-1"
                    onClick={() => {
                      send({ type: "move", from: promo.from, to: promo.to, promotion: t });
                      setPromo(null);
                      setSelected(null);
                    }}
                  >
                    <ChessPiece type={t} color={myColor ?? "w"} className="size-full" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmResign}
        onOpenChange={setConfirmResign}
        title="Resign this game?"
        description="Your opponent will win."
        confirmLabel="Resign"
        onConfirm={() => {
          send({ type: "resign" });
          setConfirmResign(false);
        }}
      />
    </div>
  );
}

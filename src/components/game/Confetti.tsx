"use client";

import { motion } from "motion/react";
import { useState } from "react";

const COLORS = ["#ff4d6d", "#ffd60a", "#4cc9f0", "#80ed99", "#f72585", "#ff9f1c", "#c77dff", "#fff", "#ff6b6b", "#ffe66d", "#48bfe3"];

type Cannon = 0 | 1 | 2;

type Piece = {
  id: number;
  cannon: Cannon;
  drift: number;
  up: number;
  fall: number;
  rot: number;
  delay: number;
  w: number;
  h: number;
  color: string;
  ribbon: boolean;
  round: boolean;
  duration: number;
};

const ORIGIN: Record<Cannon, { left: string; top: string }> = {
  0: { left: "8%", top: "86%" },
  1: { left: "92%", top: "86%" },
  2: { left: "50%", top: "34%" },
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const cannon = (i % 3) as Cannon;
    const outward = cannon === 0 ? 1 : cannon === 1 ? -1 : Math.random() < 0.5 ? 1 : -1;
    const late = i > count * 0.7;
    const ribbon = Math.random() > 0.72;
    const round = !ribbon && Math.random() > 0.78;
    return {
      id: i,
      cannon,
      drift: outward * (90 + Math.random() * (cannon === 2 ? 280 : 460)),
      up: -(220 + Math.random() * 340),
      fall: 480 + Math.random() * 320,
      rot: outward * (240 + Math.random() * 700),
      delay: Math.random() * 0.12 + (late ? 0.32 : 0),
      w: ribbon ? 5 : 7 + Math.random() * 9,
      h: ribbon ? 18 + Math.random() * 16 : round ? 8 + Math.random() * 6 : 10 + Math.random() * 12,
      color: COLORS[i % COLORS.length]!,
      ribbon,
      round,
      duration: 2.3 + Math.random() * 0.9,
    };
  });
}

/** Birthday paper blast: two corner poppers and a burst over the card. */
export function Confetti({ count = 130 }: { count?: number }) {
  const [pieces] = useState(() => makePieces(count));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0.55 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      {[0, 1].map((side) => (
        <motion.div
          key={side}
          className="absolute text-5xl"
          style={{ left: side === 0 ? "2%" : "auto", right: side === 1 ? "2%" : "auto", bottom: "6%" }}
          initial={{ scale: 0, rotate: side === 0 ? -30 : 30 }}
          animate={{ scale: [0, 1.3, 1], rotate: side === 0 ? [-30, 8, 0] : [30, -8, 0] }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          🎉
        </motion.div>
      ))}
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute"
          style={{
            ...ORIGIN[p.cannon],
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? "999px" : p.ribbon ? "999px" : "2px",
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.2 }}
          animate={{
            x: [0, p.drift * 0.72, p.drift],
            y: [0, p.up, p.fall],
            rotate: [0, p.rot * 0.45, p.rot],
            opacity: [1, 1, 0],
            scale: 1,
          }}
          transition={{ duration: p.duration, delay: p.delay, times: [0, 0.32, 1], ease: [0.16, 0.84, 0.32, 1] }}
        />
      ))}
    </div>
  );
}

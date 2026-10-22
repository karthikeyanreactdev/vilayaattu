"use client";

import { motion } from "motion/react";
import { useState } from "react";

const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#0ea5e9", "#a855f7", "#eab308", "#ec4899"];

/** Lightweight confetti burst (pure motion, no canvas). */
export function Confetti({ count = 70 }: { count?: number }) {
  const [pieces] = useState(() =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 900,
        y: 300 + Math.random() * 500,
        r: Math.random() * 720 - 360,
        delay: Math.random() * 0.25,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
        peak: -260 - Math.random() * 120,
      })),
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-1/3 left-1/2"
          style={{
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
          animate={{ x: p.x, y: [0, p.peak, p.y], rotate: p.r, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 2.2, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

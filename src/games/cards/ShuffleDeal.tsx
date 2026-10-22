"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { CARD_SIZE } from "./cardSizes";

const STACK = 12;
const RIFFLE_MS = 1300;
const DEAL_MS = 1100;

type Props = {
  /** Number of seats being dealt to (you are always at the bottom). */
  seats: number;
  /** Card back to show, so each game keeps its own look. */
  back: ReactNode;
  onDone: () => void;
  label?: string;
};

/** Where a dealt card flies for each seat: opponents fan across the top, you at the bottom. */
function seatTarget(seat: number, seats: number) {
  if (seat === 0) return { x: 0, y: 260 };
  const others = seats - 1;
  const spread = Math.min(320, 110 * others);
  const x = others === 1 ? 0 : -spread / 2 + (spread * (seat - 1)) / (others - 1);
  return { x, y: -230 };
}

/**
 * Shuffle-then-deal overlay shown when a card game starts: the deck splits,
 * riffles back together twice, then cards fly out to every seat.
 */
export function ShuffleDeal({ seats, back, onDone, label = "Shuffling…" }: Props) {
  const play = useSound();
  const [phase, setPhase] = useState<"riffle" | "deal" | "done">("riffle");

  useEffect(() => {
    play("deal");
    const riffleSound = setTimeout(() => play("deal"), RIFFLE_MS / 2);
    const toDeal = setTimeout(() => {
      setPhase("deal");
      play("card");
    }, RIFFLE_MS);
    const done = setTimeout(() => setPhase("done"), RIFFLE_MS + DEAL_MS);
    return () => [riffleSound, toDeal, done].forEach(clearTimeout);
  }, [play]);

  const dealt = Math.min(seats * 3, 18);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {phase !== "done" && (
        <motion.div
          key="shuffle"
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/25 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          aria-live="polite"
        >
          <div className="relative grid place-items-center">
            {phase === "riffle" &&
              Array.from({ length: STACK }).map((_, i) => {
                const left = i % 2 === 0;
                const lift = (i - STACK / 2) * 1.2;
                return (
                  <motion.div
                    key={`r${i}`}
                    className={cn("absolute", CARD_SIZE.md)}
                    initial={{ x: 0, y: lift, rotate: 0 }}
                    animate={{
                      // split → riffle together → split → square up
                      x: [0, left ? -46 : 46, 0, left ? -46 : 46, 0],
                      y: [lift, lift - 6, lift, lift - 6, lift],
                      rotate: [0, left ? -10 : 10, 0, left ? -10 : 10, 0],
                    }}
                    transition={{ duration: RIFFLE_MS / 1000, ease: "easeInOut", delay: (i % 6) * 0.012 }}
                    style={{ zIndex: i }}
                  >
                    {back}
                  </motion.div>
                );
              })}
            {phase === "deal" &&
              Array.from({ length: dealt }).map((_, i) => {
                const target = seatTarget(i % seats, seats);
                return (
                  <motion.div
                    key={`d${i}`}
                    className={cn("absolute", CARD_SIZE.md)}
                    initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                    animate={{ x: target.x, y: target.y, rotate: i % 2 ? 160 : -160, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.45, delay: i * ((DEAL_MS / 1000 - 0.5) / dealt), ease: [0.22, 1, 0.36, 1] }}
                    style={{ zIndex: dealt - i }}
                  >
                    {back}
                  </motion.div>
                );
              })}
            <motion.span
              className="absolute top-24 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold whitespace-nowrap text-white sm:top-28"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {phase === "riffle" ? label : "Dealing…"}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

type Props = {
  myTurn: boolean;
  /** Message when it's someone else's turn. */
  waitingText: string;
  myTurnText?: string;
  className?: string;
  finished?: boolean;
};

/** Animated "Your turn" pill. Plays a chime + buzz when your turn starts. */
export function TurnBanner({ myTurn, waitingText, myTurnText = "Your turn", className, finished }: Props) {
  const play = useSound();
  const was = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !was.current && !finished) play("turn", 40);
    was.current = myTurn;
  }, [myTurn, finished, play]);

  const text = finished ? "Game over" : myTurn ? myTurnText : waitingText;
  return (
    <div className={cn("flex justify-center", className)} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={text}
          initial={{ y: -10, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 10, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm",
            myTurn && !finished ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {myTurn && !finished && (
            <motion.span
              className="size-2 rounded-full bg-primary-foreground"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

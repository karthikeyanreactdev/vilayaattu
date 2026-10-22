"use client";

import { AnimatePresence, motion } from "motion/react";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store";
import { useSound } from "@/hooks/useSound";

const EMOJIS = ["👏", "😂", "🔥", "😮", "😭", "🙏", "😎", "🤬"];

/** Floating emoji reactions from every player. */
export function FloatingReactions() {
  const reactions = useAppSelector((s) => s.room.reactions);
  const players = useAppSelector((s) => s.room.players);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 h-0" aria-live="polite">
      <AnimatePresence>
        {reactions.map((r, i) => {
          const p = players.find((pl) => pl.id === r.playerId);
          const x = 10 + ((r.id.charCodeAt(0) * 7 + i * 13) % 75);
          return (
            <motion.div
              key={r.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${x}%` }}
              initial={{ y: 0, opacity: 0, scale: 0.4 }}
              animate={{ y: -260, opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, ease: "easeOut" }}
            >
              <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
              {p && <span className="rounded-full bg-black/50 px-2 text-[10px] text-white">{p.name}</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Emoji picker button. */
export function ReactionPicker({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const play = useSound();
  return (
    <div className="relative" data-tour="reactions">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute right-0 bottom-12 z-50 flex gap-1 rounded-full border border-border bg-popover p-1.5 shadow-xl"
          >
            {EMOJIS.map((e, i) => (
              <motion.button
                key={e}
                type="button"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.025 }}
                whileHover={{ scale: 1.3, y: -4 }}
                whileTap={{ scale: 0.8 }}
                className="text-2xl"
                onClick={() => {
                  onReact(e);
                  play("pop");
                  setOpen(false);
                }}
              >
                {e}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <Button variant="outline" size="icon" aria-label="Send a reaction" onClick={() => setOpen((o) => !o)}>
        <SmilePlus className="size-5" />
      </Button>
    </div>
  );
}

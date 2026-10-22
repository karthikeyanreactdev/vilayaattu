"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BOT_LEVELS, type BotLevel, type GameMeta } from "@/games/types";
import { cn } from "@/lib/utils";

/** "Finding players…" while quick play searches for an open table. */
type QuickProps = { meta: GameMeta | null; size: number; onCancel: () => void; onCreateNow: () => void };

export function QuickPlayDialog({ meta, size, onCancel, onCreateNow }: QuickProps) {
  return (
    <Dialog open={Boolean(meta)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        {meta && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="relative size-24">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [0.5, 1.5], opacity: [0.8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.66, ease: "easeOut" }}
                />
              ))}
              <span className="absolute inset-0 grid place-items-center text-5xl">{meta.emoji}</span>
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>
                Finding a {size}-player {meta.name} table…
              </DialogTitle>
              <DialogDescription>
                Joining an open table if there is one. Otherwise we&apos;ll open a new one that others can join.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onCreateNow}>Start a new table now</Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Finding players over peer-to-peer can take up to 15 seconds.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type VsProps = {
  meta: GameMeta | null;
  onClose: () => void;
  onStart: (level: BotLevel, opponents: number) => void;
};

/** Pick the computer's level (and how many, for multi-player games). */
export function VsComputerDialog({ meta, onClose, onStart }: VsProps) {
  const [level, setLevel] = useState<BotLevel>("intermediate");
  const [count, setCount] = useState(1);
  const maxBots = meta ? Math.min(5, meta.maxPlayers - 1) : 1;
  const opponents = Math.min(count, maxBots);

  return (
    <Dialog open={Boolean(meta)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {meta && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span aria-hidden>{meta.emoji}</span> {meta.name} vs Computer
              </DialogTitle>
              <DialogDescription>Play offline against Chitti and friends. Pick a level.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Computer level">
              {BOT_LEVELS.map((l) => (
                <motion.button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={level === l.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLevel(l.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-2xl border p-3 transition-colors",
                    level === l.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="text-3xl">{l.emoji}</span>
                  <span className="text-sm font-semibold">{l.label}</span>
                  {level === l.value && (
                    <motion.span layoutId="level-ring" className="absolute inset-0 rounded-2xl ring-2 ring-primary" />
                  )}
                </motion.button>
              ))}
            </div>
            {maxBots > 1 && (
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                <span className="text-sm font-medium">Computer players</span>
                <div className="flex items-center gap-3">
                  <Button size="icon-sm" variant="outline" aria-label="Fewer" disabled={opponents <= 1} onClick={() => setCount(opponents - 1)}>
                    <Minus />
                  </Button>
                  <span className="w-4 text-center font-bold tabular-nums">{opponents}</span>
                  <Button size="icon-sm" variant="outline" aria-label="More" disabled={opponents >= maxBots} onClick={() => setCount(opponents + 1)}>
                    <Plus />
                  </Button>
                </div>
              </div>
            )}
            <Button size="lg" className="h-11 text-base" onClick={() => onStart(level, opponents)}>
              Start game
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type SizeProps = {
  meta: GameMeta | null;
  onClose: () => void;
  onPick: (players: number) => void;
};

/** Online: how many players should the table have? Only tables of that size are matched. */
export function TableSizeDialog({ meta, onClose, onPick }: SizeProps) {
  const sizes = meta ? Array.from({ length: meta.maxPlayers - meta.minPlayers + 1 }, (_, i) => meta.minPlayers + i) : [];
  return (
    <Dialog open={Boolean(meta)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {meta && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span aria-hidden>{meta.emoji}</span> {meta.name} online
              </DialogTitle>
              <DialogDescription>How many players at the table? We&apos;ll find a table of that size, or open one.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {sizes.map((n, i) => (
                <motion.button
                  key={n}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onPick(n)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3 transition-colors hover:border-primary hover:bg-primary/10"
                >
                  <span className="text-2xl font-black tabular-nums">{n}</span>
                  <span className="text-xs text-muted-foreground">players</span>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

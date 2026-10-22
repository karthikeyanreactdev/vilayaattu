"use client";

import { motion } from "motion/react";
import { Bot, Globe } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GameTile } from "@/components/game/GameTile";
import { HowToPlay } from "@/components/game/HowToPlay";
import { CATEGORIES, GAMES } from "@/games/registry";
import type { GameCategory, GameMeta } from "@/games/types";
import { cn } from "@/lib/utils";

type Filter = "All" | GameCategory;

type Props = {
  onQuickPlay: (meta: GameMeta) => void;
  onVsComputer: (meta: GameMeta) => void;
};

/** Browsable games. Tap a card to play online; or play the computer; or read the guide. */
export function GameCatalog({ onQuickPlay, onVsComputer }: Props) {
  const [filter, setFilter] = useState<Filter>("All");
  const games = filter === "All" ? GAMES : GAMES.filter((g) => g.meta.category === filter);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10" data-tour="catalog">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">Games</h2>
          <p className="text-sm text-muted-foreground">Tap a game to play online, or take on the computer.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter games">
          {(["All", ...CATEGORIES] as Filter[]).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={cn(
                "relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                filter === c ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === c && (
                <motion.span layoutId="catalog-filter" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <span className="relative">{c}</span>
            </button>
          ))}
        </div>
      </div>
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g, i) => (
          <motion.div key={g.meta.id} layout className="flex h-full flex-col gap-2">
            <div className="flex-1">
              <GameTile meta={g.meta} index={i} onClick={() => onQuickPlay(g.meta)} />
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2" data-tour={i === 0 ? "game-actions" : undefined}>
              <Button size="sm" onClick={() => onQuickPlay(g.meta)}>
                <Globe /> Online
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onVsComputer(g.meta)}>
                <Bot /> Computer
              </Button>
              <HowToPlay meta={g.meta} iconOnly />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

"use client";

import { motion } from "motion/react";
import { Bot, Clock, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/game/GameIcon";
import { HowToPlay } from "@/components/game/HowToPlay";
import { CATEGORIES, GAMES } from "@/games/registry";
import type { GameCategory, GameMeta } from "@/games/types";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

type Filter = "All" | GameCategory;

type Props = {
  onQuickPlay: (meta: GameMeta) => void;
  onVsComputer: (meta: GameMeta) => void;
};

function range(meta: GameMeta) {
  return meta.minPlayers === meta.maxPlayers ? `${meta.minPlayers}` : `${meta.minPlayers}–${meta.maxPlayers}`;
}

/** Landing poster for one game: local name, pitch, and the two ways to play. */
function GamePoster({ meta, index, onQuickPlay, onVsComputer }: { meta: GameMeta; index: number; onQuickPlay: () => void; onVsComputer: () => void }) {
  const { t, game } = useI18n();
  const text = game(meta);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, type: "spring", stiffness: 280, damping: 26 }}
      className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm"
    >
      <button
        type="button"
        onClick={onQuickPlay}
        className={cn("relative h-36 w-full overflow-hidden bg-gradient-to-br text-left text-white", meta.accent)}
      >
        <div className="bg-kolam absolute inset-0 opacity-25" />
        <div className="absolute -right-6 -bottom-8 size-32 rounded-full bg-white/15" />
        <span className="absolute top-3 left-3 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide backdrop-blur">
          {t.categories[meta.category]}
        </span>
        <GameIcon id={meta.id} className="absolute right-3 bottom-2 size-24 drop-shadow-lg text-white" />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="indic truncate text-lg leading-tight font-black">{text.title}</h3>
          {text.subtitle && <p className="indic truncate text-xs text-muted-foreground">{text.subtitle}</p>}
        </div>
        <p className="indic line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{text.tagline}</p>
        <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Users className="size-3.5" /> {range(meta)} {t.players}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Clock className="size-3.5" /> {meta.duration} {t.minutes}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pt-1" data-tour={index === 0 ? "game-actions" : undefined}>
          <Button size="sm" className="h-auto whitespace-normal px-2 py-1.5 text-xs leading-tight" onClick={onQuickPlay}>
            <Users /> {t.online}
          </Button>
          <Button size="sm" variant="secondary" className="h-auto whitespace-normal px-2 py-1.5 text-xs leading-tight" onClick={onVsComputer}>
            <Bot /> {t.computer}
          </Button>
          <HowToPlay meta={meta} iconOnly />
        </div>
      </div>
    </motion.article>
  );
}

/** Browsable games. Tap a card to play online; or play the computer; or read the guide. */
export function GameCatalog({ onQuickPlay, onVsComputer }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("All");
  const games = filter === "All" ? GAMES : GAMES.filter((g) => g.meta.category === filter);
  const tabs: Filter[] = ["All", ...CATEGORIES];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10" data-tour="catalog">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="indic text-2xl font-extrabold">{t.games}</h2>
          <p className="indic text-sm text-muted-foreground">{t.gamesHint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t.games}>
          {tabs.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={cn(
                "indic relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                filter === c ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === c && (
                <motion.span layoutId="catalog-filter" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <span className="relative">{c === "All" ? t.all : t.categories[c]}</span>
            </button>
          ))}
        </div>
      </div>
      <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g, i) => (
          <GamePoster key={g.meta.id} meta={g.meta} index={i} onQuickPlay={() => onQuickPlay(g.meta)} onVsComputer={() => onVsComputer(g.meta)} />
        ))}
      </motion.div>
    </section>
  );
}

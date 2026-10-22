"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownUp, Check, Plus, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayingCard } from "../cards/deck";
import { PlayingCardView } from "../cards/PlayingCardView";
import { cardPoints, classifyMeld, isJoker, type MeldKind } from "./melds";

const KIND: Record<MeldKind | "loose", { label: string; bar: string; badge: string }> = {
  pure: { label: "Pure sequence", bar: "bg-emerald-400", badge: "bg-emerald-500 text-white" },
  sequence: { label: "Sequence", bar: "bg-sky-400", badge: "bg-sky-500 text-white" },
  set: { label: "Set", bar: "bg-violet-400", badge: "bg-violet-500 text-white" },
  invalid: { label: "Not a meld", bar: "bg-rose-400", badge: "bg-rose-500/90 text-white" },
  loose: { label: "Ungrouped", bar: "bg-white/40", badge: "bg-white/20 text-white" },
};

type Props = {
  groups: PlayingCard[][];
  /** Stable keys for each group (its card ids joined). */
  keys: string[];
  jokerRank: number;
  selected: string[];
  onToggle: (id: string) => void;
  onMoveInto: (groupIndex: number) => void;
  onNewGroup: () => void;
  onClear: () => void;
  onAutoArrange: () => void;
  onSort: () => void;
  /** Turn actions (discard / declare / drop) shown in the selection bar or toolbar. */
  actions?: ReactNode;
  footer?: ReactNode;
};

function Requirement({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
        ok ? "bg-emerald-500/90 text-white" : "bg-black/30 text-white/70",
      )}
    >
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {children}
    </span>
  );
}

/** Your rummy hand as labelled meld panels, with a requirements checklist and selection bar. */
export function HandGroups({ groups, keys, jokerRank, selected, onToggle, onMoveInto, onNewGroup, onClear, onAutoArrange, onSort, actions, footer }: Props) {
  const kinds = groups.map((g) => (g.length < 3 ? "loose" : classifyMeld(g, jokerRank))) as (MeldKind | "loose")[];
  const pure = kinds.includes("pure");
  const sequences = kinds.filter((k) => k === "pure" || k === "sequence").length >= 2;
  const allGrouped = kinds.every((k) => k !== "invalid" && k !== "loose");
  const selecting = selected.length > 0;

  return (
    <div className="grid gap-3">
      {/* Declare checklist + arrange tools */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Requirement ok={pure}>Pure sequence</Requirement>
        <Requirement ok={sequences}>2 sequences</Requirement>
        <Requirement ok={allGrouped}>All cards grouped</Requirement>
        <span className="mx-1 h-4 w-px bg-white/20" />
        <Button size="xs" variant="secondary" onClick={onAutoArrange}>
          <Sparkles /> Auto-arrange
        </Button>
        <Button size="xs" variant="secondary" onClick={onSort}>
          <ArrowDownUp /> By suit
        </Button>
      </div>

      {/* Meld panels */}
      <div className="flex flex-wrap items-end justify-center gap-2 px-1 pt-4">
        <AnimatePresence initial={false}>
          {groups.map((g, gi) => {
            const kind = kinds[gi];
            const style = KIND[kind];
            const pts = kind === "pure" || kind === "sequence" || kind === "set" ? 0 : g.reduce((s, c) => s + cardPoints(c, jokerRank), 0);
            const target = selecting && !g.every((c) => selected.includes(c.id));
            return (
              <motion.div
                key={keys[gi]}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className={cn(
                  "relative flex flex-col gap-1.5 overflow-visible rounded-xl bg-black/20 p-1.5 pt-0 ring-1 ring-white/10",
                  target && "ring-2 ring-amber-300/80",
                )}
              >
                <span className={cn("h-1 rounded-b-full", style.bar)} />
                <button
                  type="button"
                  onClick={() => (target ? onMoveInto(gi) : undefined)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-1 text-[10px] font-bold whitespace-nowrap",
                    target && "cursor-pointer",
                  )}
                  title={target ? "Move the selected cards into this group" : style.label}
                >
                  <span className={cn("rounded-full px-1.5 py-0.5", target ? "bg-amber-400 text-black" : style.badge)}>
                    {target ? "+ Move here" : style.label}
                  </span>
                  <span className="text-white/70">{pts > 0 ? `${pts} pts` : `${g.length}`}</span>
                </button>
                <div className="flex px-0.5">
                  {g.map((c, i) => (
                    <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -30 }}>
                      <PlayingCardView
                        card={c}
                        size="md"
                        layoutId={`r-${c.id}`}
                        wild={isJoker(c, jokerRank)}
                        selected={selected.includes(c.id)}
                        onClick={() => onToggle(c.id)}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {selecting && (
            <motion.button
              key="new-group"
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onNewGroup}
              className="flex h-[6.2rem] w-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-300/80 text-[10px] font-bold text-amber-200 sm:h-[6.9rem] sm:w-[4.5rem]"
            >
              <Plus className="size-5" /> New group
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selecting ? (
          <motion.div
            key="sel"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="mx-auto flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/45 px-3 py-1.5 shadow-lg backdrop-blur"
          >
            <span className="text-xs font-semibold">{selected.length} selected</span>
            <Button size="xs" variant="secondary" onClick={onNewGroup}>
              <Plus /> New group
            </Button>
            {actions}
            <Button size="icon-xs" variant="ghost" className="text-white hover:bg-white/10" aria-label="Clear selection" onClick={onClear}>
              <X />
            </Button>
          </motion.div>
        ) : (
          actions && (
            <motion.div key="act" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-2">
              {actions}
            </motion.div>
          )
        )}
      </AnimatePresence>
      {footer}
    </div>
  );
}

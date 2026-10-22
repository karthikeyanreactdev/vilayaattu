"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bot, Crown, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOT_LEVELS, type BotLevel } from "@/games/types";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import type { RoomPlayer } from "@/store/slices/roomSlice";

type Props = {
  players: RoomPlayer[];
  hostId: string;
  me: string;
  /** Seats at the table; empty seats are shown up to this. */
  capacity: number;
  canKick?: boolean;
  onKick?: (id: string) => void;
  /** Host only: add a computer player. */
  onAddBot?: (level: BotLevel) => void;
};

/** Seats in the room, with empty slots up to the max. */
export function PlayerList({ players, hostId, me, capacity, canKick, onKick, onAddBot }: Props) {
  const empty = Math.max(0, capacity - players.length);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" data-tour="players">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Players</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {players.length}/{capacity}
          </span>
          {onAddBot && players.length < capacity && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" data-tour="add-bot" />}>
                <Bot /> Add computer
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Computer level</DropdownMenuLabel>
                  {BOT_LEVELS.map((l) => (
                    <DropdownMenuItem key={l.value} onClick={() => onAddBot(l.value)}>
                      <span aria-hidden>{l.emoji}</span> {l.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="flex items-center gap-3 rounded-xl bg-muted/50 p-2"
            >
              <PlayerAvatar avatar={p.avatar} seat={p.seat} connected={p.connected} size="sm" />
              <span className="flex-1 truncate text-sm font-medium">
                {p.name}
                {p.id === me && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {!p.connected && <span className="text-xs text-muted-foreground">reconnecting…</span>}
              {p.bot && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Computer · {BOT_LEVELS.find((l) => l.value === p.bot)?.label}
                </span>
              )}
              {p.id === hostId && (
                <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Crown className="size-3" /> Host
                </span>
              )}
              {canKick && p.id !== me && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} onClick={() => onKick?.(p.id)}>
                  <UserX />
                </Button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {Array.from({ length: empty }).map((_, i) => (
          <li
            key={`empty-${i}`}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2 text-sm text-muted-foreground"
          >
            <span className="grid size-8 place-items-center rounded-full border border-dashed border-border">+</span>
            Waiting for a friend…
          </li>
        ))}
      </ul>
    </div>
  );
}

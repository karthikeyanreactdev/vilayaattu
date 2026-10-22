"use client";

import { motion } from "motion/react";
import { Bot, Plus, Share2, Users, Wifi } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/common/AppHeader";
import { ProfileDialog } from "@/components/common/ProfileDialog";
import { JoinRoomForm } from "@/components/forms/JoinRoomForm";
import { AppTour } from "@/components/tour/AppTour";
import { APP } from "@/config/constants";
import type { GameMeta } from "@/games/types";
import { useHydrated } from "@/hooks/useHydrated";
import { useSound } from "@/hooks/useSound";
import { useStartRoom } from "@/hooks/useStartRoom";
import { useAppSelector } from "@/store";
import { GameCatalog } from "./GameCatalog";
import { QuickPlayDialog, TableSizeDialog, VsComputerDialog } from "./PlayDialogs";

const FLOATERS = ["♞", "🐯", "🃏", "🏏", "🪵", "🫏", "🂡", "✋"];

const STEPS = [
  { icon: Plus, title: "Create a room", text: "One tap. You become the host." },
  { icon: Share2, title: "Share the code", text: "Friends join from any phone or laptop." },
  { icon: Bot, title: "Or vs computer", text: "Beginner, Intermediate or Pro." },
];

export function HomeScreen() {
  const user = useAppSelector((s) => s.user);
  const hydrated = useHydrated();
  const play = useSound();
  const start = useStartRoom();
  const [askName, setAskName] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const [searching, setSearching] = useState<{ meta: GameMeta; size: number } | null>(null);
  const [sizeMeta, setSizeMeta] = useState<GameMeta | null>(null);
  const [vsMeta, setVsMeta] = useState<GameMeta | null>(null);
  const abort = useRef<AbortController | null>(null);

  /** Run `fn` now, or after the player has told us their name. */
  const withName = (fn: () => void) => {
    if (user.name) {
      play("select");
      fn();
    } else {
      pending.current = fn;
      setAskName(true);
    }
  };

  /** Search for (or open) a table of `size` players for this game. */
  const seek = (meta: GameMeta, size: number) => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSearching({ meta, size });
    void start.quickPlay(meta.id, size, ctrl.signal).finally(() => {
      if (abort.current === ctrl) setSearching(null);
    });
  };

  // Two-player-only games skip the size question.
  const quickPlay = (meta: GameMeta) =>
    withName(() => (meta.minPlayers === meta.maxPlayers ? seek(meta, meta.minPlayers) : setSizeMeta(meta)));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-kolam absolute inset-0 opacity-60" />
          <div className="absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          {FLOATERS.map((e, i) => (
            <motion.span
              key={e}
              aria-hidden
              className="pointer-events-none absolute hidden text-4xl opacity-20 select-none lg:block"
              style={{ left: `${6 + ((i * 13) % 88)}%`, top: `${12 + ((i * 29) % 70)}%` }}
              animate={{ y: [0, -14, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
              transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {e}
            </motion.span>
          ))}

          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Wifi className="size-3.5" /> Peer-to-peer · No sign-up
              </span>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-5xl">
                {hydrated && user.name ? (
                  <>
                    Vanakkam, <span className="text-primary">{user.name}</span>!
                  </>
                ) : (
                  <>
                    Desi games, <span className="text-primary">together.</span>
                  </>
                )}
              </h1>
              <p className="tamil mt-2 text-lg text-muted-foreground">வா, விளையாடலாம்!</p>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Pallanguzhi, Aadu Puli, Hand Cricket, Chess, Rummy and more. {APP.TAGLINE}
              </p>
              <div className="mt-6 grid max-w-md grid-cols-3 gap-3">
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur"
                  >
                    <s.icon className="size-5 text-primary" />
                    <p className="mt-1.5 text-xs font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{s.text}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 22 }}
              className="rounded-3xl border border-border bg-card/90 p-5 shadow-xl backdrop-blur sm:p-6"
            >
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Users className="size-5 text-primary" /> Play with friends
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">Up to 6 players per room.</p>
              <Button
                size="lg"
                className="h-12 w-full text-base shadow-lg shadow-primary/25"
                onClick={() => withName(start.createPrivate)}
                data-tour="create"
              >
                <Plus /> Create a room
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" /> or join one <Separator className="flex-1" />
              </div>
              <div data-tour="join">
                <JoinRoomForm onJoin={(code) => withName(() => start.join(code))} />
              </div>
            </motion.div>
          </div>
        </section>

        <GameCatalog onQuickPlay={quickPlay} onVsComputer={(meta) => withName(() => setVsMeta(meta))} />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {APP.NAME} · Made with ❤️ in Tamil Nadu · Games run directly between your devices
      </footer>

      <ProfileDialog
        open={askName}
        onOpenChange={setAskName}
        onSaved={() => {
          // Continue what the player was doing before we asked for their name.
          const fn = pending.current;
          pending.current = null;
          fn?.();
        }}
      />
      <QuickPlayDialog
        meta={searching?.meta ?? null}
        size={searching?.size ?? 2}
        onCancel={() => {
          abort.current?.abort();
          abort.current = null;
          setSearching(null);
        }}
        onCreateNow={() => {
          const current = searching;
          abort.current?.abort();
          abort.current = null;
          setSearching(null);
          if (current) start.openPublic(current.meta.id, current.size);
        }}
      />
      <TableSizeDialog
        meta={sizeMeta}
        onClose={() => setSizeMeta(null)}
        onPick={(size) => {
          const meta = sizeMeta!;
          setSizeMeta(null);
          play("select");
          seek(meta, size);
        }}
      />
      <VsComputerDialog
        meta={vsMeta}
        onClose={() => setVsMeta(null)}
        onStart={(level, opponents) => {
          const meta = vsMeta!;
          setVsMeta(null);
          play("deal");
          start.vsComputer(meta.id, level, opponents);
        }}
      />
      <AppTour page="home" />
    </div>
  );
}

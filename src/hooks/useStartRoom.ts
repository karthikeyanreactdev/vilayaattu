"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ROUTES } from "@/config/constants";
import type { BotLevel } from "@/games/types";
import { generateRoomCode } from "@/lib/random";
import { seekRoom } from "@/lib/room/matchmaker";
import { claimHost } from "./useRoomSession";

/** Every way to get into a room from the home screen. */
export function useStartRoom() {
  const router = useRouter();

  const createPrivate = useCallback(() => {
    const code = generateRoomCode();
    claimHost(code, { mode: "private" });
    router.push(ROUTES.ROOM(code));
  }, [router]);

  const join = useCallback((code: string) => router.push(ROUTES.ROOM(code)), [router]);

  /** Open a new public table for this game that quick play can find. */
  const openPublic = useCallback(
    (gameId: string, capacity: number) => {
      const code = generateRoomCode();
      claimHost(code, { mode: "public", gameId, capacity });
      router.push(ROUTES.ROOM(code));
    },
    [router],
  );

  /** Join an open public table for this game, or open a new one. Returns false if cancelled. */
  const quickPlay = useCallback(
    async (gameId: string, capacity: number, signal?: AbortSignal) => {
      const found = await seekRoom(gameId, capacity, signal);
      if (signal?.aborted) return false;
      if (found) router.push(ROUTES.ROOM(found));
      else openPublic(gameId, capacity);
      return true;
    },
    [router, openPublic],
  );

  /** Offline game against computer players; starts immediately. */
  const vsComputer = useCallback(
    (gameId: string, level: BotLevel, opponents: number) => {
      const code = generateRoomCode();
      claimHost(code, { mode: "solo", gameId, capacity: opponents + 1, bots: Array(opponents).fill(level), autostart: true });
      router.push(ROUTES.ROOM(code));
    },
    [router],
  );

  return { createPrivate, join, quickPlay, openPublic, vsComputer };
}

import type { BaseGameState, GameError, GameResult, PlayerId, PlayerRef } from "./types";

/** Small helpers shared by game reducers. */

export const fail = (error: string): GameError => ({ error });

export function finish<S extends BaseGameState>(state: S, result: GameResult): S {
  return { ...state, status: "finished", result };
}

export function bump<S extends BaseGameState>(state: S): S {
  return { ...state, moveNo: state.moveNo + 1 };
}

export function nextIndex(current: number, total: number, direction: 1 | -1 = 1): number {
  return (current + direction + total) % total;
}

export function playerName(players: PlayerRef[], id: PlayerId | null | undefined): string {
  if (!id) return "";
  return players.find((p) => p.id === id)?.name ?? "Player";
}

export function sortBySeat(players: PlayerRef[]): PlayerRef[] {
  return [...players].sort((a, b) => a.seat - b.seat);
}

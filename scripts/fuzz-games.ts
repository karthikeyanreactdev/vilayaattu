/* Plays random legal-ish actions through every game to catch crashes and stuck states. */
const GAMES_PER = Number(process.env.N ?? 60);
import { GAMES } from "../src/games/registry";
import { isGameError, type PlayerRef } from "../src/games/types";
import { legalTargets } from "../src/games/chess/logic";
import { Chess } from "chess.js";
import { tigerMoves, goatMoves } from "../src/games/aadu-puli/logic";
import { COLORS } from "../src/games/onnu/logic";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function candidates(id: string, s: any, by: string): any[] {
  switch (id) {
    case "hand-cricket":
      return [{ type: "call", call: pick(["heads", "tails"]) }, { type: "choose", choice: pick(["bat", "bowl"]) }, { type: "pick", n: 1 + Math.floor(Math.random() * 6) }];
    case "book-cricket":
      return [{ type: "flip" }];
    case "ludo":
      return [{ type: "roll" }, ...[0, 1, 2, 3].map((token) => ({ type: "move", token }))];
    case "pallanguzhi":
      return Array.from({ length: 14 }, (_, pit) => ({ type: "sow", pit }));
    case "aadu-puli": {
      const out: any[] = [];
      s.board.forEach((c: any, i: number) => {
        if (c === null) out.push({ type: "place", to: i });
        if (c === "T") tigerMoves(s.board, i).forEach((m) => out.push({ type: "move", from: i, to: m.to }));
        if (c === "G") goatMoves(s.board, i).forEach((to) => out.push({ type: "move", from: i, to }));
      });
      return out;
    }
    case "chess": {
      const c = new Chess(s.fen);
      return c.moves({ verbose: true }).map((m) => ({ type: "move", from: m.from, to: m.to, promotion: "q" }));
    }
    case "kazhuthai":
      return (s.hands[by] ?? []).map((c: any) => ({ type: "play", cardId: c.id }));
    case "onnu":
      return [...(s.hands[by] ?? []).map((c: any) => ({ type: "play", cardId: c.id, color: pick(COLORS) })), { type: "draw" }, { type: "pass" }, { type: "onnu" }];
    case "rummy": {
      const cards = s.hands[by] ?? [];
      return [{ type: "draw", from: "stock" }, { type: "draw", from: "discard" }, ...cards.map((c: any) => ({ type: "discard", cardId: c.id })), ...(Math.random() < 0.01 ? [{ type: "drop" }] : []), ...(Math.random() < 0.005 && cards[0] ? [{ type: "declare", cardId: cards[0].id }] : [])];
    }
  }
  return [];
}

let failures = 0;
const only = process.argv[2];
for (const def of GAMES.filter((g) => !only || g.meta.id === only)) {
  const counts = new Set([def.meta.minPlayers, def.meta.maxPlayers]);
  for (const n of counts) {
    let finished = 0, stuck = 0, steps = 0;
    for (let g = 0; g < GAMES_PER; g++) {
      const players: PlayerRef[] = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: "x", seat: i }));
      let s: any = def.setup(players, def.defaultOptions, { now: 0 });
      let i = 0;
      for (; i < 4000 && s.status === "playing"; i++) {
        let moved = false;
        for (const p of [...players].sort(() => Math.random() - 0.5)) {
          const opts = candidates(def.meta.id, s, p.id).sort(() => Math.random() - 0.5);
          for (const a of opts) {
            const r = def.reduce(s, a, p.id, { now: i * 1000 });
            if (!isGameError(r)) { s = r; moved = true; break; }
          }
          if (moved) break;
        }
        if (!moved) { stuck++; if (process.env.DEBUG) { const tp = s.players?.[s.turn]?.id; console.log("stuck", s.phase, tp, s.status_?.[tp], s.stockCount, s.discard?.length, candidates(def.meta.id, s, tp).map((a) => { const r: any = def.reduce(s, a, tp, { now: 0 }); return r.error; }).slice(0, 4)); } break; }
        // views must never throw
        players.forEach((p) => def.view(s, p.id));
        def.view(s, "__spectator__");
      }
      steps += i;
      if (s.status === "finished") finished++;
    }
    const ok = finished > 0 && stuck === 0;
    if (!ok) failures++;
    console.log(`${ok ? "OK  " : "FAIL"} ${def.meta.id} (${n}p): finished ${finished}/${GAMES_PER}, stuck ${stuck}, avg steps ${Math.round(steps / GAMES_PER)}`);
  }
}
process.exit(failures ? 1 : 0);

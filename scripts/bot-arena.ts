/* Bot-vs-bot games for every game and level: checks bots only make legal moves and games finish. */
import { GAMES } from "../src/games/registry";
import { isGameError, type BotLevel, type PlayerRef } from "../src/games/types";

const only = process.argv[2];
const N = Number(process.env.N ?? 6);
const levels: BotLevel[] = ["beginner", "intermediate", "pro"];
let failures = 0;

for (const def of GAMES.filter((g) => !only || g.meta.id === only)) {
  for (const n of new Set([2, Math.min(4, def.meta.maxPlayers)])) {
    for (const level of levels) {
      let finished = 0, illegal = 0, stuck = 0, steps = 0, maxMs = 0;
      const wins: Record<string, number> = {};
      for (let g = 0; g < N; g++) {
        const players: PlayerRef[] = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: "x", seat: i }));
        let s: any = def.setup(players, def.defaultOptions, { now: 0 });
        let idle = 0;
        for (let i = 0; i < 3000 && s.status === "playing"; i++) {
          let acted = false;
          for (const p of players) {
            // Seat 0 plays at the tested level, others at beginner, to compare strength.
            const lv = p.seat === 0 ? level : "beginner";
            const t0 = Date.now();
            const out = def.bot(def.view(s, p.id), p.id, lv);
            maxMs = Math.max(maxMs, Date.now() - t0);
            if (!out) continue;
            for (const a of Array.isArray(out) ? out : [out]) {
              const r = def.reduce(s, a, p.id, { now: i * 1000 });
              if (isGameError(r)) { illegal++; if (illegal < 3) console.log("  illegal", def.meta.id, lv, JSON.stringify(a), r.error); break; }
              s = r; acted = true;
            }
          }
          steps++;
          if (!acted) { if (++idle > 3) { stuck++; break; } } else idle = 0;
        }
        if (s.status === "finished") { finished++; for (const w of s.result.winners) wins[w] = (wins[w] ?? 0) + 1; }
      }
      const ok = illegal === 0 && stuck === 0;
      if (!ok) failures++;
      console.log(`${ok ? "OK  " : "FAIL"} ${def.meta.id} ${n}p ${level.padEnd(12)} finished ${finished}/${N} stuck ${stuck} illegal ${illegal} seat0 wins ${wins.p0 ?? 0} slowest ${maxMs}ms`);
    }
  }
}
process.exit(failures ? 1 : 0);

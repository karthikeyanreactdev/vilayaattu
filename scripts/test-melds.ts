import { classifyMeld, checkHand } from "../src/games/rummy/melds";
const c = (s: string) => { const suit = s.slice(-1) as any; const r = s.slice(0, -1); const rank = r === "A" ? 1 : r === "J" ? 11 : r === "Q" ? 12 : r === "K" ? 13 : r === "JK" ? 0 : Number(r); return { id: s + Math.random(), rank, suit: rank === 0 ? "J" : suit }; };
const cases: [string[], number, string][] = [
  [["4H", "5H", "6H"], 9, "pure"],
  [["QS", "KS", "AS"], 9, "pure"],
  [["AS", "2S", "3S"], 9, "pure"],
  [["KS", "AS", "2S"], 9, "invalid"],
  [["4H", "9C", "6H"], 9, "sequence"],
  [["4H", "JKJ", "6H"], 9, "sequence"],
  [["7H", "7S", "7D"], 9, "set"],
  [["7H", "7H", "7D"], 9, "invalid"],
  [["7H", "7S", "JKJ", "7C"], 9, "set"],
  [["7H", "7S"], 9, "invalid"],
  [["9H", "10H", "JH"], 9, "pure"],
];
let bad = 0;
for (const [cards, jr, want] of cases) { const got = classifyMeld(cards.map(c), jr); if (got !== want) { bad++; console.log("FAIL", cards.join(" "), "want", want, "got", got); } }
const hand = [["AS","2S","3S"],["4H","5H","6H","7H"],["8C","8D","8S"],["KD","9C","QD"]].map(g => g.map(c));
const r = checkHand(hand, 9); console.log("declare valid:", r.valid, r.reason); if (!r.valid) bad++;
console.log(bad ? `${bad} failures` : "all meld tests pass"); process.exit(bad ? 1 : 0);

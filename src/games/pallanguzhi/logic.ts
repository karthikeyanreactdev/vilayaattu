import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";

/**
 * Pallanguzhi – 14 pits, 7 per player, sown anticlockwise.
 * Pick up a pit and sow one seed per pit. When the last seed lands, look at the
 * next pit: if it has seeds, pick them up and keep sowing; if it is empty,
 * capture the pit after it and your turn ends. A pit that reaches exactly 4
 * while sowing ("pasu") is taken by that pit's owner.
 */

export const PITS = 14;
export const SIDE = 7;
const MAX_STEPS = 600;

export type SowEvent =
  | { t: "pick"; pit: number; count: number }
  | { t: "drop"; pit: number }
  | { t: "pasu"; pit: number; owner: PlayerId; count: number }
  | { t: "capture"; pit: number; by: PlayerId; count: number };

export type PallanguzhiState = BaseGameState & {
  players: PlayerRef[];
  pits: number[];
  stores: Record<PlayerId, number>;
  turn: number;
  lastMove: { by: PlayerId; start: number; before: number[]; events: SowEvent[] } | null;
  pasu: boolean;
};

export type PallanguzhiAction = { type: "sow"; pit: number };

export const ownerOfPit = (pit: number) => (pit < SIDE ? 0 : 1);

function sideTotal(pits: number[], side: number) {
  return pits.slice(side * SIDE, side * SIDE + SIDE).reduce((a, b) => a + b, 0);
}

export const pallanguzhi: GameRules<PallanguzhiState, PallanguzhiAction> = {
  meta: {
    id: "pallanguzhi",
    name: "Pallanguzhi",
    tamilName: "பல்லாங்குழி",
    tagline: "The 14-pit seed game from every Tamil household.",
    emoji: "🪵",
    category: "Tamil classics",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "8–12",
    accent: "from-amber-600 to-orange-700",
    rules: [
      "Each player owns the 7 pits on their side. Every pit starts with 5 seeds.",
      "On your turn, pick up all seeds from one of your pits and sow them one by one anticlockwise.",
      "When the last seed drops, check the next pit. If it has seeds, pick them up and keep sowing.",
      "If the next pit is empty, you capture all seeds in the pit after it. Your turn ends.",
      "Pasu: if any pit reaches exactly 4 seeds while sowing, the owner of that pit takes them.",
      "When a player has no seeds on their side at their turn, the game ends. Most seeds wins.",
    ],
  },
  defaultOptions: { seeds: 5, pasu: true },
  optionFields: [
    {
      key: "seeds",
      label: "Seeds per pit",
      type: "select",
      options: [4, 5, 6].map((n) => ({ value: n, label: `${n} seeds` })),
    },
    { key: "pasu", label: "Pasu rule (4 seeds)", type: "toggle", description: "Pits reaching 4 go to the owner" },
  ],

  setup(players, options) {
    const seeds = Number(options.seeds ?? 5);
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      pits: Array(PITS).fill(seeds),
      stores: Object.fromEntries(players.map((p) => [p.id, 0])),
      turn: 0,
      lastMove: null,
      pasu: options.pasu !== false,
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The game is over.");
    const me = state.players.findIndex((p) => p.id === by);
    if (me !== state.turn) return fail("Wait for your turn.");
    const pit = action.pit;
    if (!Number.isInteger(pit) || ownerOfPit(pit) !== me) return fail("Pick a pit on your side.");
    if (state.pits[pit] === 0) return fail("That pit is empty.");

    const pits = [...state.pits];
    const stores = { ...state.stores };
    const events: SowEvent[] = [];
    let hand = pits[pit];
    pits[pit] = 0;
    events.push({ t: "pick", pit, count: hand });
    let pos = pit;
    let steps = 0;

    while (steps++ < MAX_STEPS) {
      while (hand > 0) {
        pos = (pos + 1) % PITS;
        pits[pos] += 1;
        hand -= 1;
        events.push({ t: "drop", pit: pos });
        if (state.pasu && pits[pos] === 4 && hand > 0) {
          const owner = state.players[ownerOfPit(pos)].id;
          stores[owner] += 4;
          pits[pos] = 0;
          events.push({ t: "pasu", pit: pos, owner, count: 4 });
        }
      }
      const next = (pos + 1) % PITS;
      if (pits[next] > 0) {
        hand = pits[next];
        pits[next] = 0;
        events.push({ t: "pick", pit: next, count: hand });
        pos = next;
        continue;
      }
      const target = (next + 1) % PITS;
      if (pits[target] > 0) {
        events.push({ t: "capture", pit: target, by, count: pits[target] });
        stores[by] += pits[target];
        pits[target] = 0;
      }
      break;
    }

    let nextState: PallanguzhiState = {
      ...state,
      pits,
      stores,
      turn: 1 - state.turn,
      lastMove: { by, start: pit, before: state.pits, events },
    };

    // Game ends when the player to move has nothing to sow.
    if (sideTotal(pits, nextState.turn) === 0) {
      const finalStores = { ...stores };
      state.players.forEach((p, i) => {
        finalStores[p.id] += sideTotal(pits, i);
      });
      const [a, b] = state.players;
      const sa = finalStores[a.id];
      const sb = finalStores[b.id];
      nextState = {
        ...nextState,
        stores: finalStores,
        pits: Array(PITS).fill(0),
      };
      const scores = state.players.map((p) => ({ playerId: p.id, label: `${finalStores[p.id]} seeds` }));
      nextState = finish(
        nextState,
        sa === sb
          ? { winners: [], title: "It's a draw!", detail: `${sa} seeds each`, scores }
          : {
              winners: [sa > sb ? a.id : b.id],
              title: `${(sa > sb ? a : b).name} wins!`,
              detail: `${Math.max(sa, sb)} to ${Math.min(sa, sb)} seeds`,
              scores,
            },
      );
    }
    return bump(nextState);
  },

  view: (state) => state,
};

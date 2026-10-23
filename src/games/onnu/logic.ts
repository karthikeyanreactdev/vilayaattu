import { shuffle } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";

/**
 * Onnu (ஒன்னு – "one"): an UNO-style shedding game.
 * Match the top card by colour or symbol, use action cards, and shout
 * "Onnu!" when you're down to one card or you'll be caught for +2.
 */

export type OnnuColor = "red" | "yellow" | "green" | "blue";
export type OnnuValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "draw4";

export type OnnuCard = { id: string; color: OnnuColor | "wild"; value: OnnuValue };
export type HiddenOnnu = { id: string; hidden: true };

export type OnnuState = BaseGameState & {
  players: PlayerRef[];
  hands: Record<PlayerId, (OnnuCard | HiddenOnnu)[]>;
  counts: Record<PlayerId, number>;
  deck: OnnuCard[];
  deckCount: number;
  discard: OnnuCard[];
  color: OnnuColor;
  turn: number;
  direction: 1 | -1;
  /** Card drawn this turn that may be played immediately. */
  drawnId: string | null;
  declared: Record<PlayerId, boolean>;
  stacking: boolean;
  pendingDraw: number;
  lastEvent: { kind: string; by: PlayerId; text: string; n: number } | null;
};

export type OnnuAction =
  | { type: "play"; cardId: string; color?: OnnuColor }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "onnu" }
  | { type: "catch"; target: PlayerId };

export const COLORS: OnnuColor[] = ["red", "yellow", "green", "blue"];

function buildDeck(): OnnuCard[] {
  const cards: OnnuCard[] = [];
  let n = 0;
  for (const color of COLORS) {
    cards.push({ id: `c${n++}`, color, value: "0" });
    for (const v of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"] as OnnuValue[]) {
      cards.push({ id: `c${n++}`, color, value: v });
      cards.push({ id: `c${n++}`, color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `c${n++}`, color: "wild", value: "wild" });
    cards.push({ id: `c${n++}`, color: "wild", value: "draw4" });
  }
  return shuffle(cards);
}

export function canPlay(card: OnnuCard, top: OnnuCard, color: OnnuColor, pendingDraw: number): boolean {
  if (pendingDraw > 0) {
    // While a draw stack is pending only another draw card can be stacked.
    return card.value === "draw4" || (card.value === "draw2" && top.value === "draw2");
  }
  if (card.color === "wild") return true;
  return card.color === color || card.value === top.value;
}

const hand = (s: OnnuState, id: PlayerId) => s.hands[id] as OnnuCard[];
const step = (s: OnnuState, from: number, by = 1) =>
  (((from + s.direction * by) % s.players.length) + s.players.length) % s.players.length;

/** Draw n cards for a player, reshuffling the discard pile if needed. */
function drawCards(s: OnnuState, playerId: PlayerId, n: number): { state: OnnuState; drawn: OnnuCard[] } {
  let deck = [...s.deck];
  let discard = [...s.discard];
  const drawn: OnnuCard[] = [];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      const top = discard[discard.length - 1];
      deck = shuffle(discard.slice(0, -1));
      discard = [top];
    }
    drawn.push(deck.pop()!);
  }
  const hands = { ...s.hands, [playerId]: [...hand(s, playerId), ...drawn] };
  return {
    state: { ...s, deck, discard, hands, declared: { ...s.declared, [playerId]: false } },
    drawn,
  };
}

function withCounts(s: OnnuState): OnnuState {
  return {
    ...s,
    deckCount: s.deck.length,
    counts: Object.fromEntries(s.players.map((p) => [p.id, s.hands[p.id].length])),
  };
}

export const onnu: GameRules<OnnuState, OnnuAction> = {
  meta: {
    id: "onnu",
    name: "UNO",
    tamilName: "யூனோ",
    tagline: "Match colours, play action cards, shout \"UNO!\" on your last card.",
    emoji: "🎴",
    category: "Cards",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "Easy",
    duration: "8–15",
    accent: "from-red-500 via-yellow-400 to-blue-500",
    rules: [
      "Everyone starts with 7 cards. Match the top card by colour or by number/symbol.",
      "Skip: next player loses a turn. Reverse: change direction (acts as Skip with 2 players). +2: next player draws 2.",
      "Wild: pick any colour. Wild +4: pick a colour and the next player draws 4.",
      "Can't play? Draw a card. If it fits you may play it, otherwise pass.",
      "Press UNO! when you play your second-last card. If someone catches you first, you draw 2.",
      "First to empty their hand wins.",
    ],
  },
  defaultOptions: { stacking: false, handSize: 7 },
  optionFields: [
    { key: "stacking", label: "Stack +2 / +4", type: "toggle", description: "Pass the penalty on with another draw card" },
    {
      key: "handSize",
      label: "Starting cards",
      type: "select",
      options: [5, 7, 10].map((n) => ({ value: n, label: `${n} cards` })),
    },
  ],

  setup(players, options) {
    const deck = buildDeck();
    const size = Number(options.handSize ?? 7);
    const hands: Record<PlayerId, OnnuCard[]> = {};
    for (const p of players) hands[p.id] = deck.splice(-size);
    // Start on a number card.
    let idx = deck.findIndex((c) => /^\d$/.test(c.value));
    if (idx < 0) idx = 0;
    const [first] = deck.splice(idx, 1);
    return withCounts({
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      hands,
      counts: {},
      deck,
      deckCount: 0,
      discard: [first],
      color: first.color as OnnuColor,
      turn: 0,
      direction: 1,
      drawnId: null,
      declared: Object.fromEntries(players.map((p) => [p.id, false])),
      stacking: Boolean(options.stacking),
      pendingDraw: 0,
      lastEvent: null,
    });
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The game is over.");
    const me = state.players.findIndex((p) => p.id === by);
    if (me < 0) return fail("You are watching.");
    const ev = (kind: string, text: string) => ({ kind, by, text, n: state.moveNo + 1 });

    if (action.type === "onnu") {
      const count = hand(state, by).length;
      const myTurnWithTwo = me === state.turn && count === 2;
      if (count !== 1 && !myTurnWithTwo) return fail("Call UNO when you're about to have one card.");
      return bump({ ...state, declared: { ...state.declared, [by]: true }, lastEvent: ev("onnu", "UNO!") });
    }

    if (action.type === "catch") {
      const target = action.target;
      if (target === by) return fail("You can't catch yourself.");
      if (hand(state, target)?.length !== 1 || state.declared[target]) return fail("Nobody to catch.");
      const { state: s } = drawCards(state, target, 2);
      const name = state.players.find((p) => p.id === target)?.name;
      return bump(withCounts({ ...s, lastEvent: ev("catch", `caught ${name}! +2`) }));
    }

    if (me !== state.turn) return fail("Wait for your turn.");
    const top = state.discard[state.discard.length - 1];

    if (action.type === "draw") {
      if (state.drawnId) return fail("You already drew. Play it or pass.");
      if (state.pendingDraw > 0) {
        const n = state.pendingDraw;
        const { state: s } = drawCards(state, by, n);
        return bump(
          withCounts({ ...s, pendingDraw: 0, turn: step(s, me), lastEvent: ev("draw", `drew ${n}`) }),
        );
      }
      const { state: s, drawn } = drawCards(state, by, 1);
      const card = drawn[0];
      if (card && canPlay(card, top, state.color, 0)) {
        return bump(withCounts({ ...s, drawnId: card.id, lastEvent: ev("draw", "drew a card") }));
      }
      return bump(withCounts({ ...s, drawnId: null, turn: step(s, me), lastEvent: ev("draw", "drew and passed") }));
    }

    if (action.type === "pass") {
      if (!state.drawnId) return fail("Draw a card first.");
      return bump({ ...state, drawnId: null, turn: step(state, me), lastEvent: ev("pass", "passed") });
    }

    // play
    const cards = hand(state, by);
    const card = cards.find((c) => c.id === action.cardId);
    if (!card) return fail("You don't have that card.");
    if (state.drawnId && card.id !== state.drawnId) return fail("You can only play the card you just drew.");
    if (state.pendingDraw > 0 && !state.stacking) return fail("Draw your penalty cards.");
    if (!canPlay(card, top, state.color, state.pendingDraw)) return fail("That card doesn't match.");
    if (card.color === "wild" && !action.color) return fail("Choose a colour.");

    const remaining = cards.filter((c) => c.id !== card.id);
    let s: OnnuState = {
      ...state,
      hands: { ...state.hands, [by]: remaining },
      discard: [...state.discard, card],
      color: card.color === "wild" ? action.color! : card.color,
      drawnId: null,
      declared: remaining.length === 1 ? state.declared : { ...state.declared, [by]: false },
      lastEvent: ev("play", ""),
    };

    if (remaining.length === 0) {
      const winner = state.players[me];
      return bump(
        finish(withCounts(s), {
          winners: [by],
          title: `${winner.name} wins!`,
          detail: "Went out first",
          scores: state.players.map((p) => ({
            playerId: p.id,
            label: p.id === by ? "🏆 Out" : `${hand(s, p.id).length} cards left`,
          })),
        }),
      );
    }

    const n = state.players.length;
    let nextTurn = step(s, me);
    switch (card.value) {
      case "skip":
        nextTurn = step(s, me, 2);
        s.lastEvent = ev("skip", "Skip!");
        break;
      case "reverse":
        if (n === 2) {
          nextTurn = me;
        } else {
          s = { ...s, direction: (s.direction * -1) as 1 | -1 };
          nextTurn = step(s, me);
        }
        s.lastEvent = ev("reverse", "Reverse!");
        break;
      case "draw2":
      case "draw4": {
        const add = card.value === "draw2" ? 2 : 4;
        const victimIdx = step(s, me);
        if (state.stacking) {
          s = { ...s, pendingDraw: state.pendingDraw + add };
          nextTurn = victimIdx;
          s.lastEvent = ev(card.value, `+${s.pendingDraw}`);
        } else {
          const victim = state.players[victimIdx].id;
          s = drawCards(s, victim, add).state;
          nextTurn = step(s, me, 2);
          s.lastEvent = ev(card.value, `+${add}`);
        }
        break;
      }
      case "wild":
        s.lastEvent = ev("wild", "Wild!");
        break;
    }
    return bump(withCounts({ ...s, turn: nextTurn }));
  },

  view(state, viewer) {
    const hands: OnnuState["hands"] = {};
    for (const p of state.players) {
      const cards = hand(state, p.id);
      hands[p.id] = p.id === viewer ? cards : cards.map((c) => ({ id: c.id, hidden: true as const }));
    }
    return { ...state, hands, deck: [] };
  },
};

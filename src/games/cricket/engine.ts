import type { GameResult, OptionField, PlayerId, PlayerRef } from "../types";

/** Scoring engine shared by Hand Cricket and Book Cricket. */

export type Ball = {
  runs: number;
  out: boolean;
  /** Legal deliveries count towards the over. No-balls don't. */
  legal: boolean;
  label: string;
};

export type Innings = {
  batter: PlayerId;
  bowler: PlayerId;
  runs: number;
  wickets: number;
  balls: number;
  log: Ball[];
};

export type CricketCore = {
  innings: Innings[];
  current: 0 | 1;
  target: number | null;
  maxWickets: number;
  /** 0 = unlimited balls. */
  maxBalls: number;
};

export const CRICKET_OPTIONS: OptionField[] = [
  {
    key: "wickets",
    label: "Wickets",
    type: "select",
    options: [1, 2, 3, 5].map((n) => ({ value: n, label: `${n}` })),
  },
  {
    key: "overs",
    label: "Overs",
    type: "select",
    options: [
      { value: 0, label: "Unlimited" },
      { value: 1, label: "1 over" },
      { value: 2, label: "2 overs" },
      { value: 3, label: "3 overs" },
      { value: 5, label: "5 overs" },
    ],
  },
];

export function newInnings(batter: PlayerId, bowler: PlayerId): Innings {
  return { batter, bowler, runs: 0, wickets: 0, balls: 0, log: [] };
}

export function createCore(batter: PlayerId, bowler: PlayerId, wickets: number, overs: number): CricketCore {
  return {
    innings: [newInnings(batter, bowler)],
    current: 0,
    target: null,
    maxWickets: Math.max(1, wickets),
    maxBalls: Math.max(0, overs) * 6,
  };
}

export function currentInnings(core: CricketCore): Innings {
  return core.innings[core.current];
}

export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/** Returns the updated core and, if the match ended, its result. */
export function recordBall(
  core: CricketCore,
  ball: Ball,
  players: PlayerRef[],
): { core: CricketCore; inningsOver: boolean; result: GameResult | null } {
  const inn = { ...currentInnings(core) };
  inn.runs += ball.runs;
  if (ball.out) inn.wickets += 1;
  if (ball.legal) inn.balls += 1;
  inn.log = [...inn.log, ball];

  const innings = [...core.innings];
  innings[core.current] = inn;
  let next: CricketCore = { ...core, innings };

  const allOut = inn.wickets >= core.maxWickets;
  const oversDone = core.maxBalls > 0 && inn.balls >= core.maxBalls;
  const chased = core.current === 1 && core.target !== null && inn.runs >= core.target;

  if (!(allOut || oversDone || chased)) return { core: next, inningsOver: false, result: null };

  if (core.current === 0) {
    next = {
      ...next,
      current: 1,
      target: inn.runs + 1,
      innings: [...innings, newInnings(inn.bowler, inn.batter)],
    };
    return { core: next, inningsOver: true, result: null };
  }

  return { core: next, inningsOver: true, result: matchResult(next, players) };
}

function nameOf(players: PlayerRef[], id: PlayerId) {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

export function matchResult(core: CricketCore, players: PlayerRef[]): GameResult {
  const [first, second] = core.innings;
  const target = core.target ?? first.runs + 1;
  const scores = core.innings.map((i) => ({
    playerId: i.batter,
    label: `${i.runs}/${i.wickets} (${formatOvers(i.balls)})`,
  }));
  if (second.runs >= target) {
    const left = core.maxWickets - second.wickets;
    return {
      winners: [second.batter],
      title: `${nameOf(players, second.batter)} wins!`,
      detail: `Chased ${target} with ${left} wicket${left === 1 ? "" : "s"} to spare`,
      scores,
    };
  }
  if (second.runs === target - 1) {
    return { winners: [], title: "Match tied!", detail: "Both scored the same. What a finish!", scores };
  }
  const margin = target - 1 - second.runs;
  return {
    winners: [first.batter],
    title: `${nameOf(players, first.batter)} wins!`,
    detail: `Won by ${margin} run${margin === 1 ? "" : "s"}`,
    scores,
  };
}

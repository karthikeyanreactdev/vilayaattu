/**
 * Aadu Puli Attam board: 23 points. An apex, then four rows. Rows 2–4 extend
 * sideways into small rectangles, the traditional "ears" of the board.
 *
 *             0
 *        1  2   3  4
 *    5   6  7   8  9   10
 *    11 12 13  14 15   16
 *    17 18 19  20 21   22
 */

export const POINTS = 23;

export const LINES: number[][] = [
  [1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22],
  [0, 1, 6, 12, 18],
  [0, 2, 7, 13, 19],
  [0, 3, 8, 14, 20],
  [0, 4, 9, 15, 21],
  [5, 11, 17],
  [10, 16, 22],
];

const ROW_Y = [6, 30, 54, 76, 98];
const BASE_X = [12, 38, 62, 88];
const EAR_X = [2, 98];

function fanX(i: number, y: number) {
  return 50 + (BASE_X[i] - 50) * ((y - ROW_Y[0]) / (ROW_Y[4] - ROW_Y[0]));
}

/** Point coordinates in a 100 × 104 viewBox. */
export const COORDS: { x: number; y: number }[] = (() => {
  const c: { x: number; y: number }[] = [{ x: 50, y: ROW_Y[0] }];
  for (let i = 0; i < 4; i++) c.push({ x: fanX(i, ROW_Y[1]), y: ROW_Y[1] });
  for (let row = 2; row <= 4; row++) {
    const y = ROW_Y[row];
    c.push({ x: EAR_X[0], y });
    for (let i = 0; i < 4; i++) c.push({ x: fanX(i, y), y });
    c.push({ x: EAR_X[1], y });
  }
  return c;
})();

/** Neighbours along any line. */
export const ADJ: number[][] = (() => {
  const adj: Set<number>[] = Array.from({ length: POINTS }, () => new Set<number>());
  for (const line of LINES) {
    for (let i = 0; i < line.length - 1; i++) {
      adj[line[i]].add(line[i + 1]);
      adj[line[i + 1]].add(line[i]);
    }
  }
  return adj.map((s) => [...s]);
})();

/** Jumps: from -> over -> to, all on one straight line. */
export const JUMPS: { from: number; over: number; to: number }[] = (() => {
  const jumps: { from: number; over: number; to: number }[] = [];
  for (const line of LINES) {
    for (let i = 0; i < line.length - 2; i++) {
      jumps.push({ from: line[i], over: line[i + 1], to: line[i + 2] });
      jumps.push({ from: line[i + 2], over: line[i + 1], to: line[i] });
    }
  }
  return jumps;
})();

/** Line segments for drawing. */
export const SEGMENTS: [number, number][] = LINES.flatMap((line) =>
  line.slice(0, -1).map((p, i) => [p, line[i + 1]] as [number, number]),
);

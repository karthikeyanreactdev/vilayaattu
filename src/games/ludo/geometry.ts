/** 15×15 Ludo board. Row 0 is the top. Red's start square is the first track cell. */

export const TRACK: readonly (readonly [number, number])[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

/** Where each colour steps onto the track. */
export const START = [0, 13, 26, 39] as const;

/** Start squares and the star eight steps later. Tokens here cannot be sent home. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME: readonly (readonly (readonly [number, number])[])[] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
];

export const CENTRE: readonly [number, number] = [7, 7];

export const YARD: readonly (readonly (readonly [number, number])[])[] = [
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
  [[10, 1], [10, 4], [13, 1], [13, 4]],
];

export const COLOURS = [
  { name: "Red", fill: "#dc2626", soft: "#fecaca", yard: "#f87171" },
  { name: "Green", fill: "#16a34a", soft: "#bbf7d0", yard: "#4ade80" },
  { name: "Yellow", fill: "#ca8a04", soft: "#fef08a", yard: "#facc15" },
  { name: "Blue", fill: "#2563eb", soft: "#bfdbfe", yard: "#60a5fa" },
] as const;

/** World position (x, z) of a square's centre. White sits at +Z, rank 1 nearest. */
export function squarePos(sq: string): [number, number] {
  return [sq.charCodeAt(0) - 97 - 3.5, 3.5 - (Number(sq[1]) - 1)];
}

export const FILES = "abcdefgh";

export const SQUARES: string[] = Array.from({ length: 64 }, (_, i) => `${FILES[i % 8]}${Math.floor(i / 8) + 1}`);

/** Which way a side's pieces look when standing still: across the board at the enemy. */
export const FACING = { w: Math.PI, b: 0 } as const;

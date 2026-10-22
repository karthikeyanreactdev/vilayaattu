/**
 * Statue-style Staunton chess pieces (original SVG artwork).
 * Ivory and ebony gradients, a turned plinth, rim light and a contact shadow
 * so each piece reads as a carved figure rather than a flat token.
 */

export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
export type PieceColor = "w" | "b";

const PLINTH =
  "M9.5 36.2h26a1.6 1.6 0 0 1 1.6 1.6v1.3a1.6 1.6 0 0 1-1.6 1.6h-26a1.6 1.6 0 0 1-1.6-1.6v-1.3a1.6 1.6 0 0 1 1.6-1.6z";
const SKIRT = "M11.5 36.2c1-1.4 2.2-2.3 3.4-2.8h15.2c1.2.5 2.4 1.4 3.4 2.8z";

const BODY: Record<PieceType, string[]> = {
  p: [
    "M22.5 8.2a4.6 4.6 0 0 0-2.7 8.3c-2.1.9-3.6 2.4-3.6 4.1h12.6c0-1.7-1.5-3.2-3.6-4.1a4.6 4.6 0 0 0-2.7-8.3z",
    "M16.6 20.6h11.8l-.9 1.9h-10z",
    "M17.5 22.5c0 4.5-1.6 8-3.1 10.9h16.2c-1.5-2.9-3.1-6.4-3.1-10.9z",
  ],
  r: [
    "M13.6 9.4h3.6v2.6h2.6V9.4h5.4v2.6h2.6V9.4h3.6v6.2H13.6z",
    "M13.6 15.6h17.8l-2 2.2H15.6z",
    "M16 17.8h13l1.3 13.4H14.7z",
    "M14.1 31.2h16.8l.5 2.2H13.6z",
  ],
  b: [
    "M22.5 4.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z",
    "M22.5 8.6c-5.2 3.8-7.4 8.7-6.3 12.5.9 1.9 11.7 1.9 12.6 0 1.1-3.8-1.1-8.7-6.3-12.5z",
    "M15.8 22h13.4l-1 2.3H16.8z",
    "M17.6 24.3c0 4.4-1.6 6.6-3.2 9.1h16.2c-1.6-2.5-3.2-4.7-3.2-9.1z",
  ],
  q: [
    "M11.6 12.4l3.4 10.4h15l3.4-10.4-5.3 5.4-2.2-8.4-3.4 7.9-3.4-7.9-2.2 8.4z",
    "M14.4 22.8h16.2l-1 2.5H15.4z",
    "M16.2 25.3c0 3.6-1.6 5.6-3.1 8.1h18.8c-1.5-2.5-3.1-4.5-3.1-8.1z",
  ],
  k: [
    "M21.3 2.6h2.4v2.6h2.6v2.3h-2.6v2.8h-2.4V7.5h-2.6V5.2h2.6z",
    "M22.5 10.3c-6.4 0-10.6 3-9.6 7.1l2.1 5.4h15l2.1-5.4c1-4.1-3.2-7.1-9.6-7.1z",
    "M14.4 22.8h16.2l-1 2.5H15.4z",
    "M16.2 25.3c0 3.6-1.6 5.6-3.1 8.1h18.8c-1.5-2.5-3.1-4.5-3.1-8.1z",
  ],
  n: [
    "M14.2 33.4c-.3-5.4 2.4-8.3 5.4-11-2.6.2-4.9 1.2-6.7 2.9-1.3-1.7-.6-3.9 1.1-5.6 2.8-2.9 4.6-5.5 5.6-9.4l1.9-3.3 1.2 2.9c5.3 1.1 9.4 5.6 10.2 12.2.7 5.2-.8 8.6-1 11.3z",
  ],
};

/** Decorative details drawn on top (eyes, mane, crown bands). */
const DETAILS: Partial<Record<PieceType, React.ReactNode>> = {
  n: (
    <>
      <circle cx={21.2} cy={13.6} r={0.9} />
      <path d="M24.4 11.8c2.8 1.6 4.6 4.6 5 8.6M23.3 14.6c2.2 1.5 3.4 3.8 3.6 6.8" fill="none" strokeWidth={0.7} />
    </>
  ),
  k: <path d="M14.2 18.2h16.6M15.4 21h14.2" fill="none" strokeWidth={0.7} />,
  q: (
    <>
      {[
        [11.6, 11.2],
        [16.8, 8.6],
        [22.5, 7.4],
        [28.2, 8.6],
        [33.4, 11.2],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r={1.9} />
      ))}
    </>
  ),
  b: <path d="M24.6 12.2l-3.9 5.8" fill="none" strokeWidth={0.9} />,
  r: <path d="M16.3 21.5h12.4M15.9 26h13.2" fill="none" strokeWidth={0.6} />,
};

export function PieceDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="ivory" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="45%" stopColor="#f3e7cc" />
          <stop offset="100%" stopColor="#b9a27a" />
        </linearGradient>
        <linearGradient id="ebony" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#6b625b" />
          <stop offset="40%" stopColor="#2b2522" />
          <stop offset="100%" stopColor="#0c0a09" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="35%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="contact" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function ChessPiece({ type, color, className }: { type: PieceType; color: PieceColor; className?: string }) {
  const white = color === "w";
  const fill = white ? "url(#ivory)" : "url(#ebony)";
  const stroke = white ? "#4a3a28" : "#000";
  const detail = white ? "#6b5537" : "#a8a29e";
  const paths = [...BODY[type], SKIRT, PLINTH];
  return (
    <svg viewBox="0 0 45 45" className={className} aria-label={`${white ? "White" : "Black"} ${type}`}>
      <ellipse cx={22.5} cy={41.4} rx={14} ry={2.2} fill="url(#contact)" />
      <g fill={fill} stroke={stroke} strokeWidth={0.9} strokeLinejoin="round">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {type === "q" && <g>{DETAILS.q}</g>}
      </g>
      {/* rim light */}
      <g fill="url(#sheen)" stroke="none" opacity={white ? 0.9 : 0.55}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {type !== "q" && DETAILS[type] && (
        <g stroke={detail} fill={detail}>
          {DETAILS[type]}
        </g>
      )}
    </svg>
  );
}

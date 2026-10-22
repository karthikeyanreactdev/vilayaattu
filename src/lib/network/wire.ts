/**
 * Firebase Realtime Database deletes nulls and empty arrays/objects, and a
 * missing index turns the rest of an array into holes. Game views use both
 * (empty move lists, empty squares), so the guest board crashed on start.
 * These marks survive the round trip and never appear in game data.
 */
const NULL_MARK = "\u0000n";
const EMPTY_MARK = "\u0000e";

function encode(value: unknown): unknown {
  if (value === null) return NULL_MARK;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return [EMPTY_MARK];
    return value.map(encode);
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return { e: EMPTY_MARK };
  const out: Record<string, unknown> = {};
  for (const [key, inner] of entries) out[key] = encode(inner);
  return out;
}

function decode(value: unknown): unknown {
  if (value === NULL_MARK) return null;
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] === EMPTY_MARK) return [];
    return value.map(decode);
  }
  const obj = value as Record<string, unknown>;
  if (obj.e === EMPTY_MARK && Object.keys(obj).length === 1) return {};
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(obj)) out[key] = decode(inner);
  return out;
}

export function encodeWire<T>(value: T): T {
  return encode(value) as T;
}

export function decodeWire<T>(value: T): T {
  return decode(value) as T;
}

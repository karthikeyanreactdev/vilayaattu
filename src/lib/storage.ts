/** Safe wrappers around web storage: never throw (private mode, SSR, quota). */

function safe(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function make(kind: "local" | "session") {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = safe(kind)?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    set(key: string, value: unknown) {
      try {
        safe(kind)?.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
    remove(key: string) {
      try {
        safe(kind)?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const storage = make("local");
export const sessionStore = make("session");

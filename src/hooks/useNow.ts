"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `interval` ms while `active`. */
export function useNow(active: boolean, interval = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [active, interval]);
  return now;
}

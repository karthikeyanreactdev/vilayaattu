"use client";

import { useSyncExternalStore } from "react";
import type { VoiceMesh, VoiceSnapshot } from "@/lib/voice/voiceMesh";

export function useVoice(mesh: VoiceMesh | null): VoiceSnapshot | null {
  return useSyncExternalStore(
    (listener) => (mesh ? mesh.subscribe(listener) : () => undefined),
    () => mesh?.snapshot() ?? null,
    () => null,
  );
}

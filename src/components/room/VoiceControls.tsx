"use client";

import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/useVoice";
import type { RoomSession } from "@/lib/room/roomSession";
import type { VoiceSnapshot } from "@/lib/voice/voiceMesh";

function hint(snap: VoiceSnapshot) {
  if (snap.mic === "denied") return "The microphone is blocked. Allow it in the browser, then tap Mic again.";
  if (snap.mic === "busy") return "Allow the microphone so the table can hear you.";
  if (snap.phase === "failed") return "Voice can't get through this network. Tap Try again.";
  if (snap.phase === "connecting") return "Connecting the call…";
  if (snap.phase === "live") return snap.mic === "on" ? "Mic is on. Everyone at the table can hear you." : "Speaker is on. Tap the mic to talk back.";
  return "Tap the mic to talk. Friends in this room hear you, and you hear them.";
}

/** Mic and speaker for the people in this room. Hidden against the computer. */
export function VoiceControls({ session, compact = false }: { session: RoomSession; compact?: boolean }) {
  const mesh = session.voice;
  const snap = useVoice(mesh);

  useEffect(() => {
    if (snap?.mic === "denied") toast.error("Allow the microphone to talk.", { id: "mic-blocked" });
  }, [snap?.mic]);

  if (!mesh || !snap) return null;

  const micLabel = snap.mic === "on" ? "Mute microphone" : "Turn microphone on";
  const speakerLabel = snap.speaker ? "Mute speakers" : "Turn speakers on";

  const buttons = (
    <>
      <Button
        size={compact ? "icon" : "default"}
        className={compact ? undefined : "h-11 flex-1"}
        variant={snap.mic === "on" ? "default" : "outline"}
        aria-pressed={snap.mic === "on"}
        aria-label={micLabel}
        disabled={snap.mic === "busy"}
        onClick={() => void mesh.toggleMic()}
      >
        {snap.mic === "on" ? <Mic /> : <MicOff />}
        {compact ? null : snap.mic === "on" ? "Mic on" : "Mic off"}
      </Button>
      <Button
        size={compact ? "icon" : "default"}
        className={compact ? undefined : "h-11 flex-1"}
        variant={snap.speaker ? "default" : "outline"}
        aria-pressed={snap.speaker}
        aria-label={speakerLabel}
        onClick={() => mesh.toggleSpeaker()}
      >
        {snap.speaker ? <Volume2 /> : <VolumeX />}
        {compact ? null : snap.speaker ? "Speaker" : "Silent"}
      </Button>
    </>
  );

  if (compact) {
    return (
      <div className="flex shrink-0 gap-1" data-voice={snap.phase}>
        {buttons}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" data-voice={snap.phase}>
      <h2 className="font-semibold">Talk</h2>
      <p className="mt-1 text-xs text-muted-foreground">{hint(snap)}</p>
      <div className="mt-3 flex gap-2">{buttons}</div>
      {snap.phase === "failed" && (
        <Button variant="outline" className="mt-2 w-full" onClick={() => mesh.retry()}>
          Try again
        </Button>
      )}
    </div>
  );
}

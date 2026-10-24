"use client";

import { GripHorizontal, Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ReactionPad } from "@/components/game/Reactions";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/useVoice";
import type { RoomSession } from "@/lib/room/roomSession";
import type { RemoteCall } from "@/lib/voice/voiceMesh";
import { useAppSelector } from "@/store";

function CallVideo({ stream, mirror }: { stream: MediaStream; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={mirror ? "size-full scale-x-[-1] object-cover" : "size-full object-cover"} />;
}

function Tile({ remote }: { remote: RemoteCall }) {
  const video = remote.camera ? remote.stream.getVideoTracks()[0] : undefined;
  return (
    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-900 shadow-md">
      {video ? <CallVideo stream={remote.stream} /> : <div className="grid size-full place-items-center text-3xl">{remote.avatar}</div>}
      <p className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] font-medium text-white">{remote.name}</p>
    </div>
  );
}

/** Floating mic, speaker, and video for everyone in the room. */
export function VoiceControls({ session }: { session: RoomSession }) {
  const mesh = session.voice;
  const snap = useVoice(mesh);
  const room = useAppSelector((s) => s.room);
  const me = useAppSelector((s) => s.user);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (snap?.mic === "denied") toast.error("Allow the microphone to talk.", { id: "mic-blocked" });
  }, [snap?.mic]);

  useEffect(() => {
    if (snap?.camera === "denied") toast.error("Allow the camera.", { id: "cam-blocked" });
  }, [snap?.camera]);

  useEffect(() => {
    if (!room.videoAllowed) void mesh?.stopCamera();
  }, [mesh, room.videoAllowed]);

  if (!mesh || !snap) return null;

  const remotes = Object.values(snap.remotes);
  const hint =
    snap.mic === "denied"
      ? "Allow the microphone in the browser."
      : snap.phase === "failed"
        ? "Voice can't get through. Try again."
        : snap.phase === "connecting"
          ? "Connecting…"
          : snap.phase === "live"
            ? snap.mic === "on"
              ? "Everyone can hear you."
              : "Tap the mic to talk."
            : "Tap the mic. Everyone in the room can talk.";

  return (
    <div
      ref={panel}
      data-voice={snap.phase}
      data-hearing={snap.hearing}
      data-seeing={snap.seeing}
      className="fixed z-40 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card/95 p-2 shadow-xl backdrop-blur"
      style={pos ? { left: pos.x, top: pos.y } : { right: 12, top: "max(4.5rem, calc(env(safe-area-inset-top) + 3.5rem))" }}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground active:cursor-grabbing"
          aria-label="Move call"
          onPointerDown={(event) => {
            const rect = panel.current?.getBoundingClientRect();
            if (!rect) return;
            drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPos({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <GripHorizontal className="size-4" />
        </button>
        <Button
          size="icon"
          variant={snap.mic === "on" ? "default" : "outline"}
          aria-pressed={snap.mic === "on"}
          aria-label={snap.mic === "on" ? "Mute microphone" : "Turn microphone on"}
          disabled={snap.mic === "busy"}
          onClick={() => void mesh.toggleMic()}
        >
          {snap.mic === "on" ? <Mic /> : <MicOff />}
        </Button>
        <Button
          size="icon"
          variant={snap.speaker ? "default" : "outline"}
          aria-pressed={snap.speaker}
          aria-label={snap.speaker ? "Mute speakers" : "Turn speakers on"}
          onClick={() => mesh.toggleSpeaker()}
        >
          {snap.speaker ? <Volume2 /> : <VolumeX />}
        </Button>
        {room.videoAllowed && (
          <Button
            size="icon"
            variant={snap.camera === "on" ? "default" : "outline"}
            aria-pressed={snap.camera === "on"}
            aria-label={snap.camera === "on" ? "Turn camera off" : "Turn camera on"}
            disabled={snap.camera === "busy"}
            onClick={() => void mesh.toggleCamera()}
          >
            {snap.camera === "on" ? <Video /> : <VideoOff />}
          </Button>
        )}
      </div>
      {room.isHost && (
        <Button
          variant={room.videoAllowed ? "secondary" : "outline"}
          className="mt-2 h-8 w-full text-xs"
          aria-pressed={room.videoAllowed}
          onClick={() => session.setVideoAllowed(!room.videoAllowed)}
        >
          {room.videoAllowed ? "Stop video for everyone" : "Allow video"}
        </Button>
      )}
      <p className="mt-1 px-1 text-[11px] text-muted-foreground">{room.isHost && !room.videoAllowed ? `${hint} You can allow video.` : hint}</p>
      {(snap.localPreview || remotes.length > 0) && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {snap.localPreview && (
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-900 shadow-md">
              <CallVideo stream={snap.localPreview} mirror />
              <p className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] font-medium text-white">{me.name || "You"}</p>
            </div>
          )}
          {remotes.map((remote) => (
            <Tile key={remote.stream.id} remote={remote} />
          ))}
        </div>
      )}
      {snap.phase === "failed" && (
        <Button variant="outline" className="mt-2 w-full" onClick={() => mesh.retry()}>
          Try again
        </Button>
      )}
      <ReactionPad onReact={(emoji) => session.sendReaction(emoji)} />
    </div>
  );
}

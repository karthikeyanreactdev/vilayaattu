"use client";

import { AnimatePresence, motion } from "motion/react";
import { GripHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppSelector } from "@/store";
import { useSound } from "@/hooks/useSound";

const EMOJIS = ["👏", "😂", "🔥", "😮", "😭", "🙏", "😎", "🤬"];

/** The game frame uses a transform, which traps `fixed` children. Render on the body instead. */
function useBody() {
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  return body;
}

/** Big reactions that rise over the board. */
export function FloatingReactions() {
  const reactions = useAppSelector((s) => s.room.reactions);
  const players = useAppSelector((s) => s.room.players);
  const body = useBody();
  if (!body) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] h-0" aria-live="polite">
      <AnimatePresence>
        {reactions.map((r, i) => {
          const name = players.find((p) => p.id === r.playerId)?.name;
          const x = 12 + ((r.id.charCodeAt(0) * 7 + i * 13) % 70);
          return (
            <motion.div
              key={r.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${x}%` }}
              initial={{ y: 0, opacity: 0, scale: 0.4 }}
              animate={{ y: -280, opacity: [0, 1, 1, 0], scale: [0.4, 1.4, 1.1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, ease: "easeOut" }}
            >
              <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
              {name && <span className="rounded-full bg-black/55 px-2 text-[10px] font-medium text-white">{name}</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    body,
  );
}

/** Draggable window for sending a reaction. */
export function ReactionWindow({ onReact }: { onReact: (emoji: string) => void }) {
  const play = useSound();
  const body = useBody();
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!body) return null;

  return createPortal(
    <div
      ref={panel}
      data-tour="reactions"
      className="fixed z-[70] w-[min(15rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card/95 p-2 shadow-xl backdrop-blur"
      style={pos ? { left: pos.x, top: pos.y } : { left: 12, bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground active:cursor-grabbing"
          aria-label="Move reactions"
          onPointerDown={(event) => {
            const rect = panel.current?.getBoundingClientRect();
            if (!rect) return;
            drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const width = panel.current?.offsetWidth ?? 200;
            const height = panel.current?.offsetHeight ?? 120;
            const x = Math.min(window.innerWidth - width - 8, Math.max(8, event.clientX - drag.current.dx));
            const y = Math.min(window.innerHeight - height - 8, Math.max(8, event.clientY - drag.current.dy));
            setPos({ x, y });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <GripHorizontal className="size-4" />
        </button>
        <p className="text-xs font-semibold">Reactions</p>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="rounded-xl py-1 text-2xl transition-transform hover:scale-110 active:scale-90"
            aria-label={`Send ${emoji}`}
            onClick={() => {
              onReact(emoji);
              play("pop");
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>,
    body,
  );
}

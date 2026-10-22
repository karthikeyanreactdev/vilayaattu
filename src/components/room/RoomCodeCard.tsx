"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { APP, ROUTES } from "@/config/constants";
import { formatRoomCode } from "@/lib/random";
import { useSound } from "@/hooks/useSound";

/** Big, tappable invite code with copy and native share. */
export function RoomCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const play = useSound();
  const url = typeof window !== "undefined" ? `${window.location.origin}${ROUTES.ROOM(code)}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatRoomCode(code));
      setCopied(true);
      play("select");
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Long-press the code instead.");
    }
  };

  const share = async () => {
    const text = `Join my ${APP.NAME} room! Code: ${formatRoomCode(code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: APP.NAME, text, url });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => undefined);
      toast.success("Invite link copied");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm" data-tour="room-code">
      <div className="bg-kolam pointer-events-none absolute inset-0 opacity-40" />
      <p className="relative text-xs font-medium tracking-wide text-muted-foreground uppercase">Invite code</p>
      <button
        type="button"
        onClick={copy}
        className="relative mt-1 flex w-full items-center justify-between gap-3 rounded-xl text-left"
        aria-label="Copy room code"
      >
        <span className="flex gap-1 font-mono text-3xl font-black tracking-wider sm:text-4xl">
          {formatRoomCode(code)
            .split("")
            .map((ch, i) => (
              <motion.span
                key={i}
                initial={{ y: 20, opacity: 0, rotateX: 90 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                transition={{ delay: 0.05 * i, type: "spring", stiffness: 400, damping: 20 }}
                className={ch === "-" ? "text-muted-foreground" : "text-primary"}
              >
                {ch}
              </motion.span>
            ))}
        </span>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={copied ? "y" : "n"} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      <div className="relative mt-3 flex gap-2">
        <Button onClick={share} className="flex-1" data-tour="share">
          <Share2 /> Invite friends
        </Button>
      </div>
    </div>
  );
}

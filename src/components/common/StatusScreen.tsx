"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  emoji?: string;
  title: string;
  description?: string;
  loading?: boolean;
  actions?: ReactNode;
};

/** Full-height friendly state screen (connecting, not found, errors). */
export function StatusScreen({ emoji, title, description, loading, actions }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-w-sm flex-col items-center gap-4 text-center"
      >
        {loading ? (
          <div className="relative size-16">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary"
                animate={{ scale: [0.4, 1.4], opacity: [0.9, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
              />
            ))}
            <span className="absolute inset-0 grid place-items-center text-3xl">{emoji ?? "🎲"}</span>
          </div>
        ) : (
          <motion.span
            className="text-6xl"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
          >
            {emoji}
          </motion.span>
        )}
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
      </motion.div>
    </div>
  );
}

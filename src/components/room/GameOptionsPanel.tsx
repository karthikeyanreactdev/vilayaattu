"use client";

import { motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { GameOptions, OptionField } from "@/games/types";
import { cn } from "@/lib/utils";

type Props = {
  fields: OptionField[];
  values: GameOptions;
  editable: boolean;
  onChange: (key: string, value: string | number | boolean) => void;
};

/** Renders a game's option fields as segmented pills and switches. */
export function GameOptionsPanel({ fields, values, editable, onChange }: Props) {
  if (fields.length === 0) return <p className="text-sm text-muted-foreground">No settings. Just play!</p>;
  return (
    <div className="grid gap-4">
      {fields.map((f) =>
        f.type === "select" ? (
          <div key={f.key} className="grid gap-2">
            <Label>{f.label}</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label}>
              {f.options.map((o) => {
                const active = values[f.key] === o.value;
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!editable}
                    onClick={() => onChange(f.key, o.value)}
                    className={cn(
                      "relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      !editable && !active && "opacity-60",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`opt-${f.key}`}
                        className="absolute inset-0 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={`opt-${f.key}`}>{f.label}</Label>
              {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
            </div>
            <Switch
              id={`opt-${f.key}`}
              checked={Boolean(values[f.key])}
              disabled={!editable}
              onCheckedChange={(v) => onChange(f.key, Boolean(v))}
            />
          </div>
        ),
      )}
    </div>
  );
}

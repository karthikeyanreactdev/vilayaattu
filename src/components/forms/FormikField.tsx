"use client";

import { useField } from "formik";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof Input> & {
  name: string;
  label: string;
  hint?: string;
  /** Transform raw input before it's stored (e.g. upper-casing a code). */
  transform?: (value: string) => string;
};

/** shadcn Input wired to Formik with an animated error message. */
export function FormikField({ name, label, hint, transform, className, ...rest }: Props) {
  const [field, meta, helpers] = useField<string>(name);
  const showError = meta.touched && Boolean(meta.error);
  const id = rest.id ?? `field-${name}`;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...field}
        {...rest}
        id={id}
        aria-invalid={showError}
        aria-describedby={`${id}-msg`}
        className={cn("h-11 text-base", className)}
        onChange={(e) => helpers.setValue(transform ? transform(e.target.value) : e.target.value)}
      />
      <div id={`${id}-msg`} className="min-h-5 text-xs">
        <AnimatePresence mode="wait" initial={false}>
          {showError ? (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-destructive"
            >
              {meta.error}
            </motion.p>
          ) : hint ? (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground">
              {hint}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

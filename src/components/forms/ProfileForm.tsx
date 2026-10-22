"use client";

import { Form, Formik } from "formik";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { USER } from "@/config/constants";
import { profileSchema, type ProfileValues } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { FormikField } from "./FormikField";

type Props = {
  initial: ProfileValues;
  submitLabel?: string;
  onSubmit: (values: ProfileValues) => void;
};

/** Name + avatar picker. Used on first visit and from the profile menu. */
export function ProfileForm({ initial, submitLabel = "Save", onSubmit }: Props) {
  return (
    <Formik<ProfileValues>
      initialValues={initial}
      validationSchema={profileSchema}
      onSubmit={(values) => onSubmit({ ...values, name: values.name.trim() })}
    >
      {({ values, setFieldValue, isValid, dirty }) => (
        <Form className="grid gap-4" noValidate>
          <FormikField
            name="name"
            label="Your name"
            placeholder="e.g. Karthi"
            autoComplete="nickname"
            maxLength={USER.NAME_MAX}
            hint="Shown to other players in the room"
            autoFocus
          />
          <div className="grid gap-2">
            <Label>Pick an avatar</Label>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar">
              {USER.AVATARS.map((emoji) => {
                const active = values.avatar === emoji;
                return (
                  <motion.button
                    key={emoji}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    whileTap={{ scale: 0.85 }}
                    whileHover={{ scale: 1.08 }}
                    onClick={() => setFieldValue("avatar", emoji)}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-xl border text-2xl transition-colors",
                      active ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted",
                    )}
                  >
                    {emoji}
                    {active && (
                      <motion.span
                        layoutId="avatar-ring"
                        className="absolute inset-0 rounded-xl ring-2 ring-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
          <Button type="submit" size="lg" className="h-11 text-base" disabled={!isValid || (!dirty && !initial.name)}>
            {submitLabel}
          </Button>
        </Form>
      )}
    </Formik>
  );
}

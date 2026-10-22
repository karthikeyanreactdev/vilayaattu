"use client";

import { Form, Formik } from "formik";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROOM } from "@/config/constants";
import { normalizeRoomCode } from "@/lib/random";
import { joinRoomSchema, type JoinRoomValues } from "@/lib/validation";
import { FormikField } from "./FormikField";

type Props = { onJoin: (code: string) => void; disabled?: boolean };

export function JoinRoomForm({ onJoin, disabled }: Props) {
  return (
    <Formik<JoinRoomValues>
      initialValues={{ code: "" }}
      validationSchema={joinRoomSchema}
      onSubmit={(v) => onJoin(normalizeRoomCode(v.code))}
    >
      {({ isValid, dirty }) => (
        <Form className="grid gap-2" noValidate>
          <FormikField
            name="code"
            label="Room code"
            placeholder="ABC-123"
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            maxLength={ROOM.CODE_LENGTH + 1}
            className="text-center font-mono text-xl tracking-[0.3em] uppercase"
            transform={(v) => {
              const c = normalizeRoomCode(v).slice(0, ROOM.CODE_LENGTH);
              return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
            }}
          />
          <Button type="submit" size="lg" variant="secondary" className="h-11 text-base" disabled={disabled || !isValid || !dirty}>
            <LogIn /> Join room
          </Button>
        </Form>
      )}
    </Formik>
  );
}

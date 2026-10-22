import * as Yup from "yup";
import { ROOM, USER } from "@/config/constants";
import { normalizeRoomCode } from "./random";

/** Shared Yup schemas so forms stay consistent (and a backend can reuse the rules). */

export const profileSchema = Yup.object({
  name: Yup.string()
    .trim()
    .required("Tell us your name")
    .min(USER.NAME_MIN, `At least ${USER.NAME_MIN} characters`)
    .max(USER.NAME_MAX, `At most ${USER.NAME_MAX} characters`)
    .matches(/^[\p{L}\p{M}\p{N} ._-]+$/u, "Letters, numbers and spaces only"),
  avatar: Yup.string().required(),
});

export const joinRoomSchema = Yup.object({
  code: Yup.string()
    .required("Enter the room code")
    .test("len", `Codes are ${ROOM.CODE_LENGTH} characters`, (v) => normalizeRoomCode(v ?? "").length === ROOM.CODE_LENGTH)
    .test("chars", "That doesn't look like a room code", (v) =>
      [...normalizeRoomCode(v ?? "")].every((ch) => ROOM.CODE_ALPHABET.includes(ch)),
    ),
});

export type ProfileValues = Yup.InferType<typeof profileSchema>;
export type JoinRoomValues = Yup.InferType<typeof joinRoomSchema>;

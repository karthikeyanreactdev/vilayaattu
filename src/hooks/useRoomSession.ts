"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { STORAGE_KEYS } from "@/config/constants";
import { soundEngine } from "@/lib/audio/soundEngine";
import { RoomSession, type HostConfig } from "@/lib/room/roomSession";
import { sessionStore } from "@/lib/storage";
import { useAppDispatch, useAppSelector } from "@/store";
import { roomClosed, roomOpened, statusChanged } from "@/store/slices/roomSlice";
import { gameCleared } from "@/store/slices/gameSlice";

/** Mark this tab as the host of `code` (call before navigating to the room). */
export function claimHost(code: string, config: HostConfig = { mode: "private" }) {
  sessionStore.set(STORAGE_KEYS.HOST_SESSION(code), { config });
}

export function isHostOf(code: string) {
  return sessionStore.get(STORAGE_KEYS.HOST_SESSION(code)) !== null;
}

export function forgetRoom(code: string) {
  sessionStore.remove(STORAGE_KEYS.HOST_SESSION(code));
}

/** Opens a RoomSession for the lifetime of the room page. */
export function useRoomSession(code: string): RoomSession | null {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user);
  const [session, setSession] = useState<RoomSession | null>(null);
  const ready = user.hydrated && Boolean(user.name);

  useEffect(() => {
    if (!ready) return;
    const isHost = isHostOf(code);
    dispatch(gameCleared());
    dispatch(roomOpened({ code, isHost }));
    const s = new RoomSession(code, isHost, { id: user.id, name: user.name, avatar: user.avatar }, dispatch, (msg) => {
      soundEngine.play("error");
      toast.error(msg, { id: "game-error" });
    });
    s.connect()
      .then(() => {
        if (s.active) setSession(s);
      })
      .catch((err: unknown) => {
        if (!s.active) return;
        dispatch(statusChanged({ status: "closed", message: err instanceof Error ? err.message : "Connection failed" }));
      });
    return () => {
      s.dispose();
      dispatch(roomClosed());
      dispatch(gameCleared());
      setSession(null);
    };
    // Profile edits are pushed separately below; only reconnect when the room changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, ready, dispatch]);

  useEffect(() => {
    if (session && user.name) session.updateProfile({ id: user.id, name: user.name, avatar: user.avatar });
  }, [session, user.id, user.name, user.avatar]);

  return session;
}

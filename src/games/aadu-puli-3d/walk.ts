import { useEffect, useState } from "react";

/** Where the walker stands and looks. yaw 0 looks down -Z; pitch up is positive. */
export type Pose = { x: number; z: number; yaw: number; pitch: number; moving: boolean };

/** Touch joystick and buttons write here; the rig reads it every frame. */
export type WalkInput = {
  /** -1…1 strafe (right positive) and forward (forward positive) from the on-screen stick. */
  stick: { x: number; y: number };
  sprint: boolean;
  crouch: boolean;
};

/**
 * Mutable walker state shared by the camera rig, the radar and the HUD. It changes
 * every frame, so it lives outside React state; readers look at it from their own
 * animation loops and writers go through the setters.
 */
export type WalkStore = {
  readonly pose: Pose;
  readonly input: WalkInput;
  set: (patch: Partial<Pose>) => void;
  setStick: (x: number, y: number) => void;
  setSprint: (on: boolean) => void;
  setCrouch: (on: boolean) => void;
};

export function createWalkStore(spawn: Pose): WalkStore {
  const pose: Pose = { ...spawn };
  const input: WalkInput = { stick: { x: 0, y: 0 }, sprint: false, crouch: false };
  return {
    pose,
    input,
    set: (patch) => Object.assign(pose, patch),
    setStick: (x, y) => {
      input.stick.x = x;
      input.stick.y = y;
    },
    setSprint: (on) => {
      input.sprint = on;
    },
    setCrouch: (on) => {
      input.crouch = on;
    },
  };
}

/** Spawn behind your own side: tigers at the apex, goats at the wide base, watchers on the flank. */
export function spawnFor(role: "T" | "G" | null): Pose {
  if (role === "T") return { x: -3.4, z: -13, yaw: Math.PI + 0.26, pitch: -0.06, moving: false };
  if (role === "G") return { x: 5.5, z: 12.2, yaw: -0.42, pitch: -0.06, moving: false };
  return { x: -13.6, z: 2, yaw: -Math.PI / 2, pitch: -0.08, moving: false };
}

/** True for `ms` after `stamp` last changed (0 means never). */
export function useRecent(stamp: number, ms: number) {
  // Remember which stamp has run out rather than a boolean, so no state is set during the effect itself.
  const [expired, setExpired] = useState(0);
  useEffect(() => {
    if (!stamp) return;
    const t = setTimeout(() => setExpired(stamp), ms);
    return () => clearTimeout(t);
  }, [stamp, ms]);
  return stamp !== 0 && expired !== stamp;
}

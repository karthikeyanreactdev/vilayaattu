import { API } from "@/config/constants";
import { apiClient } from "./client";

/**
 * Backend service stubs. When a server exists, the room layer can call these
 * (e.g. to validate codes or persist results) without touching UI code.
 */

export type RoomInfo = { code: string; hostName: string; gameId: string | null; players: number };

export const roomService = {
  create: (hostName: string) =>
    apiClient.post<RoomInfo>(API.ENDPOINTS.ROOMS, { hostName }).then((r) => r.data),
  get: (code: string) => apiClient.get<RoomInfo>(API.ENDPOINTS.ROOM(code)).then((r) => r.data),
};

export const profileService = {
  me: () => apiClient.get<{ id: string; name: string }>(API.ENDPOINTS.PROFILE).then((r) => r.data),
};

import axios, { AxiosError, type AxiosInstance } from "axios";
import toast from "react-hot-toast";
import { API, STORAGE_KEYS } from "@/config/constants";
import { storage } from "@/lib/storage";

/**
 * Shared axios instance for the future backend. The app is peer-to-peer today,
 * so nothing calls this yet, but services in ./services are ready to use it.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API.BASE_URL,
  timeout: API.TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const user = storage.get<{ token?: string }>(STORAGE_KEYS.USER);
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

export type ApiError = { message: string; status?: number };

export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string } | undefined;
    return {
      message: data?.message ?? error.message ?? "Network error",
      status: error.response?.status,
    };
  }
  return { message: error instanceof Error ? error.message : "Unknown error" };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);
    if (typeof window !== "undefined" && apiError.status !== 401) {
      toast.error(apiError.message);
    }
    return Promise.reject(apiError);
  },
);

import { NETWORK, type TransportKind } from "@/config/constants";
import { sessionStore } from "@/lib/storage";
import type { Transport } from "./types";

export * from "./types";

/**
 * Pick a transport. `?net=local` in the URL forces the same-browser transport (for this tab),
 * which is useful for testing with several tabs.
 * Add a "socket" implementation here when the backend arrives.
 */
export async function createTransport(roomCode: string, kind?: TransportKind): Promise<Transport> {
  const fromUrl =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("net") as TransportKind | null)
      : null;
  // Remember a ?net= override for the rest of this tab's session.
  if (fromUrl) sessionStore.set("vt:net", fromUrl);
  const chosen = kind ?? fromUrl ?? sessionStore.get<TransportKind>("vt:net") ?? NETWORK.TRANSPORT;

  if (chosen === "local") {
    const { LocalTransport } = await import("./localTransport");
    return new LocalTransport(roomCode);
  }
  if (chosen === "socket") {
    throw new Error("Socket transport needs a backend. Set NEXT_PUBLIC_TRANSPORT=p2p for now.");
  }
  const { P2PTransport } = await import("./p2pTransport");
  return new P2PTransport(roomCode);
}

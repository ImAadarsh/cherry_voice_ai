"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

const SYNC_KEY = "omnidim_last_sync";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Auto-sync Omnidim agents and calls once per session / interval on dashboard routes. */
export function useOmnidimSync(enabled = true) {
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    if (typeof window === "undefined") return;

    const last = Number(sessionStorage.getItem(SYNC_KEY) ?? 0);
    if (Date.now() - last < SYNC_INTERVAL_MS) return;

    ran.current = true;
    api
      .post("/api/omnidim/sync")
      .then(() => sessionStorage.setItem(SYNC_KEY, String(Date.now())))
      .catch(() => {
        ran.current = false;
      });
  }, [enabled]);
}

export async function manualOmnidimSync() {
  const result = await api.post<{ agents: { synced: number }; calls: { synced: number } }>(
    "/api/omnidim/sync",
  );
  sessionStorage.setItem(SYNC_KEY, String(Date.now()));
  return result;
}

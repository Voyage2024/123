"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

/** Writes a throttled last-seen heartbeat for the authenticated user. */
export default function PresenceHeartbeat() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const beat = async () => {
      if (!active || document.visibilityState !== "visible" || inFlight.current) return;
      inFlight.current = true;
      try {
        const { error } = await supabase.rpc("touch_profile_last_seen");
        if (error && active) {
          // One short diagnostic, without user-identifying data.
          console.warn("[presence] heartbeat failed", error.code ?? "unknown");
        }
      } catch {
        if (active) console.warn("[presence] heartbeat unavailable");
      } finally {
        inFlight.current = false;
      }
    };

    void beat();
    const interval = window.setInterval(() => void beat(), 2 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void beat(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId]);

  return null;
}

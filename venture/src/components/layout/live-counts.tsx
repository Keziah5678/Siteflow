"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Counts = { notifications: number; messages: number };
const Ctx = createContext<Counts>({ notifications: 0, messages: 0 });
export const useLiveCounts = () => useContext(Ctx);

/** Unread counters kept fresh with Supabase Realtime (RLS-filtered). */
export function LiveCountsProvider({ userId, initial, children }: { userId: string | null; initial: Counts; children: React.ReactNode }) {
  // Realtime increments on top of the latest server-rendered baseline.
  const [state, setState] = useState({ base: initial, delta: { notifications: 0, messages: 0 } });
  if (state.base.notifications !== initial.notifications || state.base.messages !== initial.messages) {
    setState({ base: initial, delta: { notifications: 0, messages: 0 } });
  }
  const counts = { notifications: state.base.notifications + state.delta.notifications, messages: state.base.messages + state.delta.messages };
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`counts:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const type = (payload.new as { type?: string }).type;
        setState((s) => ({ ...s, delta: { notifications: s.delta.notifications + 1, messages: s.delta.messages + (type === "message" ? 1 : 0) } }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
  return <Ctx.Provider value={counts}>{children}</Ctx.Provider>;
}

export function CountBadge({ kind, className }: { kind: keyof Counts; className?: string }) {
  const n = useLiveCounts()[kind];
  if (!n) return null;
  return (
    <span className={className ?? "absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-[18px] text-white"} aria-label={`${n} non lu${n > 1 ? "s" : ""}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getRepository, type Session } from "@/lib/data";
import { Loading } from "./ui";

type Ctx = { session: Session | null; ready: boolean; mode: "local" | "supabase"; refresh: () => Promise<void> };
const SessionCtx = createContext<Ctx>({ session: null, ready: false, mode: "local", refresh: async () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const repo = getRepository();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => { setSession(await repo.getSession()); };
  useEffect(() => {
    repo.getSession().then(s => { setSession(s); setReady(true); }).catch(() => setReady(true));
    return repo.onAuthChange(s => setSession(s));
  }, [repo]);
  return <SessionCtx.Provider value={{ session, ready, mode: repo.mode, refresh }}>{children}</SessionCtx.Provider>;
}

/** Wraps pages that need a signed-in user; sends others to /auth and back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (ready && !session) router.replace(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [ready, session, router]);
  if (!ready || !session) return <Loading label="Ouverture du portail" />;
  return <>{children}</>;
}

"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRepository, type Repository } from "@/lib/data";
import { WorldBrain } from "@/lib/engine/brain";
import { formatTick, identityFor } from "@/lib/engine/constitution";
import { can, roleOf, type Capability } from "@/lib/engine/permissions";
import type { Entity, Role, WorldState } from "@/lib/engine/types";
import type { WorldVisualIdentity } from "@/lib/world/identity";
import { useSession } from "../session";

type Ctx = {
  state: WorldState;
  repo: Repository;
  role: Role | null;
  can: (cap: Capability) => boolean;
  identity: WorldVisualIdentity;
  brain: WorldBrain;
  byId: Map<string, Entity>;
  reload: () => Promise<void>;
  now: string;
  userId: string | null;
};

const WorldCtx = createContext<Ctx | null>(null);
export function useWorld(): Ctx {
  const c = useContext(WorldCtx);
  if (!c) throw new Error("useWorld outside WorldProvider");
  return c;
}

export function WorldProvider({ worldId, children, fallback, error }: { worldId: string; children: ReactNode; fallback: ReactNode; error: (msg: string) => ReactNode }) {
  const repo = getRepository();
  const { session } = useSession();
  const [state, setState] = useState<WorldState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setState(await repo.loadWorld(worldId)); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [repo, worldId]);
  useEffect(() => { reload(); return repo.subscribe(worldId, () => { reload(); }); }, [repo, worldId, reload]);

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    const role = roleOf(state.world, state.members, session?.userId);
    return {
      state, repo, role,
      can: (cap: Capability) => can(role, cap, state.world.constitution),
      // Derived live from id + constitution, so an amendment (climate, era…) shows at once.
      identity: identityFor(state.world),
      brain: new WorldBrain(state),
      byId: new Map(state.entities.map(e => [e.id, e])),
      reload,
      now: formatTick(state.world.tick, state.world.constitution),
      userId: session?.userId ?? null
    };
  }, [state, repo, session, reload]);

  if (err && !state) return <>{error(err)}</>;
  if (!value) return <>{fallback}</>;
  return <WorldCtx.Provider value={value}>{children}</WorldCtx.Provider>;
}

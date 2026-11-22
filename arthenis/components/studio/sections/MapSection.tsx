"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { identityFor } from "@/lib/engine/constitution";
import { KIND_ICON, KIND_LABEL, isCosmic, planetOf } from "@/lib/engine/hierarchy";
import type { EntityKind } from "@/lib/engine/types";
import TerrainCanvas from "@/lib/world/TerrainCanvas";
import { Img } from "../../ui";
import { artFor } from "../../art";
import type { MapApi } from "../../map/WorldMap3D";
import { MAP_LEVELS, webglAvailable } from "../../map/WorldMap3D";
import Dossier from "../Dossier";
import EntityEditor from "../EntityEditor";
import { useWorld } from "../WorldContext";

const WorldMap3D = dynamic(() => import("../../map/WorldMap3D"), { ssr: false, loading: () => <div className="loading-screen">Formation du relief…</div> });
const CosmosView = dynamic(() => import("../../map/CosmosView"), { ssr: false });

const PALETTE: EntityKind[] = ["continent", "country", "region", "city", "village", "place", "civilization", "character", "npc", "creature", "animal", "resource", "quest"];
const COSMIC: EntityKind[] = ["galaxy", "star_system", "planet"];

export default function MapSection() {
  const { state, byId, can, identity: worldIdentity } = useWorld();
  const c = state.world.constitution;
  const shell = useRef<HTMLDivElement>(null);
  const api = useRef<MapApi | null>(null);
  const [surface, setSurface] = useState<string | null>(null); // planet id, null = main surface
  const [view, setView] = useState<"surface" | "cosmos">("surface");
  const [cosmosOpened, setCosmosOpened] = useState(false);
  useEffect(() => { if (view === "cosmos") setCosmosOpened(true); }, [view]);
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState<EntityKind | null>(null);
  const [draftAt, setDraftAt] = useState<{ x: number; y: number; kind: EntityKind } | null>(null);
  const [cosmicCreate, setCosmicCreate] = useState<EntityKind | null>(null);
  const [dossier, setDossier] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [territories, setTerritories] = useState(true);
  const [relations, setRelations] = useState(true);
  const [level, setLevel] = useState(0);
  const [gl, setGl] = useState(true);
  const [fs, setFs] = useState(false);
  useEffect(() => { setGl(webglAvailable()); }, []);
  useEffect(() => { const on = () => setFs(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", on); return () => document.removeEventListener("fullscreenchange", on); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setPlacing(null); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const planets = state.entities.filter(e => e.kind === "planet" && e.status !== "archived");
  const hasCosmos = state.entities.some(e => isCosmic(e.kind) || e.kind === "planet");
  const identity = useMemo(() => (surface ? identityFor(state.world, surface) : worldIdentity), [surface, state.world, worldIdentity]);
  const onSurface = useMemo(() => state.entities.filter(e => !isCosmic(e.kind) && e.kind !== "planet" && planetOf(e, byId) === surface), [state.entities, byId, surface]);
  const placedCount = onSurface.filter(e => e.x != null).length;
  const sel = selected ? byId.get(selected) : undefined;
  const canCreate = can("write") || can("propose");
  const surfaceName = surface ? byId.get(surface)?.name : state.world.name;

  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen(); else shell.current?.requestFullscreen?.().catch(() => {}); };

  return (
    <div className="map-shell" ref={shell} data-testid="map-shell">
      {/* Both scenes stay mounted once opened: unmounting a canvas holding HTML labels breaks React's DOM bookkeeping. */}
      {cosmosOpened && (
        <div className="map-canvas" style={{ display: view === "cosmos" ? "block" : "none" }}>
          <CosmosView active={view === "cosmos"} entities={state.entities.filter(e => isCosmic(e.kind) || e.kind === "planet")} selectedId={selected} onSelect={setSelected} onEnterPlanet={id => { setSurface(id); setView("surface"); setSelected(null); }} />
        </div>
      )}
      <div className="map-canvas" style={{ display: view === "surface" ? "block" : "none" }}>
        {gl ? (
          <WorldMap3D active={view === "surface"} identity={identity} entities={onSurface} relations={state.relations} blank={c.blank} selectedId={selected} placing={placing}
            showLabels={labels} showTerritories={territories} showRelations={relations} apiRef={api}
            onSelect={setSelected} onLevel={setLevel}
            onPlace={(x, y) => { if (placing) setDraftAt({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind: placing }); }} />
        ) : (
          <div className="map-canvas"><TerrainCanvas identity={identity} view={{ x: 50, y: 50, z: 1, w: 1000, h: 700 }} showScenery /><div className="terra-incognita"><b>WebGL indisponible</b><span className="small muted">Votre appareil n&apos;affiche pas la 3D : voici l&apos;atlas 2D du même terrain. Les créations restent possibles depuis les listes.</span></div></div>
        )}
      </div>

      <div className="map-hud tl">
        <div className="hud-chip"><b className="display">{view === "cosmos" ? "Cosmos" : surfaceName}</b><span className="faint">·</span><span className="small muted">{state.entities.length} éléments</span></div>
        {view === "surface" && <div className="hud-chip levels" aria-label="Échelle">{MAP_LEVELS.map((l, i) => <span key={l} className={i === level ? "on" : ""}>{l}</span>)}</div>}
        {(hasCosmos || planets.length > 0) && (
          <div className="hud-chip row wrap" style={{ gap: 6 }}>
            {hasCosmos && <button className={`btn sm ${view === "cosmos" ? "primary" : "ghost"}`} onClick={() => setView("cosmos")}>✺ Cosmos</button>}
            <button className={`btn sm ${view === "surface" && !surface ? "primary" : "ghost"}`} onClick={() => { setSurface(null); setView("surface"); }}>◍ {state.world.name}</button>
            {planets.map(p => <button key={p.id} className={`btn sm ${view === "surface" && surface === p.id ? "primary" : "ghost"}`} onClick={() => { setSurface(p.id); setView("surface"); }}>◍ {p.name}</button>)}
          </div>
        )}
        {placing && <div className="hud-chip" style={{ borderColor: "var(--violet)" }}>Cliquez sur le terrain pour placer : <b>{KIND_LABEL[placing]}</b> <button className="btn ghost sm" onClick={() => setPlacing(null)}>Annuler</button></div>}
      </div>

      <div className="map-hud tr">
        <button className="hud-btn" aria-label="Plein écran" title="Plein écran" onClick={toggleFs}>{fs ? "⤡" : "⛶"}</button>
        {view === "surface" && <>
          <button className="hud-btn" aria-label="Zoomer" title="Zoomer" onClick={() => api.current?.zoom(0.6)}>＋</button>
          <button className="hud-btn" aria-label="Dézoomer" title="Dézoomer" onClick={() => api.current?.zoom(1.6)}>－</button>
          <button className="hud-btn" aria-label="Vue du dessus" title="Vue du dessus" onClick={() => api.current?.top()}>⊙</button>
          <button className="hud-btn" aria-label="Recentrer" title="Recentrer" onClick={() => api.current?.reset()}>⌂</button>
          <button className={`hud-btn ${labels ? "on" : ""}`} aria-label="Étiquettes" title="Étiquettes" onClick={() => setLabels(v => !v)}>Aa</button>
          <button className={`hud-btn ${territories ? "on" : ""}`} aria-label="Territoires et frontières" title="Territoires et frontières" onClick={() => setTerritories(v => !v)}>◌</button>
          <button className={`hud-btn ${relations ? "on" : ""}`} aria-label="Guerres et alliances" title="Guerres et alliances" onClick={() => setRelations(v => !v)}>⚔</button>
        </>}
      </div>

      {view === "surface" && c.blank && placedCount === 0 && !placing && (
        <div className="terra-incognita" data-testid="terra-incognita">
          <span style={{ fontSize: 30, color: "var(--violet)" }}>✦</span>
          <h3 className="display">Terra incognita</h3>
          <p className="small muted">Ce monde est encore blanc. Chaque continent, région ou cité que vous placez révèle le terrain autour de lui.</p>
          {canCreate && <button className="btn primary" onClick={() => setPlacing("continent")}>Placer un premier continent</button>}
        </div>
      )}

      {canCreate && (
        <div className="map-hud bl">
          {view === "surface" ? (
            <div className="palette" role="toolbar" aria-label="Créer sur la carte">
              {PALETTE.map(k => <button key={k} className={placing === k ? "on" : ""} data-testid={`place-${k}`} onClick={() => setPlacing(p => (p === k ? null : k))}>{KIND_ICON[k]} <span className="hide-sm">{KIND_LABEL[k]}</span></button>)}
            </div>
          ) : (
            <div className="palette">{COSMIC.map(k => <button key={k} onClick={() => setCosmicCreate(k)}>{KIND_ICON[k]} {KIND_LABEL[k]}</button>)}</div>
          )}
        </div>
      )}

      {sel && !dossier && (
        <div className="side-sheet panel stack" data-testid="map-selection">
          <div className="row between"><span className="badge violet">{KIND_ICON[sel.kind]} {KIND_LABEL[sel.kind]}</span><button className="btn ghost sm" aria-label="Fermer" onClick={() => setSelected(null)}>✕</button></div>
          <div className="dossier-img" style={{ aspectRatio: "16 / 9" }}><Img src={sel.imageUrl} fallback={artFor(identity, sel)} alt="" /></div>
          <h3 className="display">{sel.name}</h3>
          <p className="small muted" style={{ maxHeight: 120, overflow: "auto" }}>{sel.summary || "Aucune description."}</p>
          {typeof sel.data.population === "number" && <span className="small">Population : {Math.round(sel.data.population as number).toLocaleString("fr-FR")}{typeof sel.data.tier === "string" ? ` · ${sel.data.tier}` : ""}</span>}
          {sel.status !== "active" && <span className="badge">{sel.status}</span>}
          <div className="row wrap">
            <button className="btn sm primary" onClick={() => setDossier(sel.id)}>Dossier complet</button>
            {sel.x != null && view === "surface" && <button className="btn sm" onClick={() => api.current?.focus(sel.x!, sel.y!)}>Survoler</button>}
            {sel.kind === "planet" && <button className="btn sm" onClick={() => { setSurface(sel.id); setView("surface"); }}>Descendre à la surface</button>}
          </div>
        </div>
      )}

      {draftAt && <EntityEditor kind={draftAt.kind} position={{ x: draftAt.x, y: draftAt.y }} parentId={surface} onClose={() => { setDraftAt(null); }} onSaved={e => { setPlacing(null); if (e) setSelected(e.id); }} />}
      {cosmicCreate && <EntityEditor kind={cosmicCreate} kinds={COSMIC} onClose={() => setCosmicCreate(null)} onSaved={e => e && setSelected(e.id)} />}
      {dossier && <Dossier id={dossier} onClose={() => setDossier(null)} onFocusMap={e => { setView("surface"); api.current?.focus(e.x!, e.y!); }} />}
    </div>
  );
}

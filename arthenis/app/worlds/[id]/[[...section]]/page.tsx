"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { RequireAuth, useSession } from "@/components/session";
import { Empty, Loading } from "@/components/ui";
import { WorldProvider, useWorld } from "@/components/studio/WorldContext";
import MapSection from "@/components/studio/sections/MapSection";
import Timeline from "@/components/studio/sections/Timeline";
import { Atlas, Brain, EntityList, GuardianSection, Overview } from "@/components/studio/sections/Sections";
import { Collaboration, History, Settings } from "@/components/studio/sections/Collab";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import type { EntityKind } from "@/lib/engine/types";

type Section = { id: string; label: string; icon: string; group: string; kinds?: EntityKind[] };
const SECTIONS: Section[] = [
  { id: "map", label: "Carte", icon: "◍", group: "Monde" },
  { id: "overview", label: "World Studio", icon: "✺", group: "Monde" },
  { id: "atlas", label: "Atlas & lieux", icon: "⛰", group: "Monde" },
  { id: "brain", label: "World Brain", icon: "❂", group: "Intelligence" },
  { id: "guardian", label: "Guardian AI", icon: "⚖", group: "Intelligence" },
  { id: "timeline", label: "Chronologie", icon: "⧗", group: "Intelligence" },
  { id: "characters", label: "Personnages", icon: "♛", group: "Création", kinds: ["character", "npc", "family", "dynasty"] },
  { id: "creatures", label: "Créatures", icon: "🐾", group: "Création", kinds: ["creature", "animal", "species", "deity"] },
  { id: "civilizations", label: "Civilisations", icon: "⚜", group: "Création", kinds: ["civilization", "faction", "organization", "religion", "language", "technology"] },
  { id: "resources", label: "Ressources & objets", icon: "◆", group: "Création", kinds: ["resource", "item"] },
  { id: "quests", label: "Quêtes", icon: "✧", group: "Création", kinds: ["quest"] },
  { id: "collaboration", label: "Collaboration", icon: "⚑", group: "Gouvernance" },
  { id: "history", label: "Révisions", icon: "☥", group: "Gouvernance" },
  { id: "settings", label: "Paramètres & lois", icon: "⚙", group: "Gouvernance" }
];
const INTRO: Record<string, string> = {
  characters: "Personnages principaux, PNJ, familles et dynasties",
  creatures: "Animaux, créatures, espèces et divinités — selon vos lois",
  civilizations: "Peuples, factions, organisations, religions, langues, technologies",
  resources: "Ce que le monde produit, consomme et transmet",
  quests: "Objectifs, missions et intrigues en cours"
};

function Studio({ section }: { section: string }) {
  const { state, role, now } = useWorld();
  const s = SECTIONS.find(x => x.id === section) ?? SECTIONS[0];
  const count = (kinds?: EntityKind[]) => kinds ? state.entities.filter(e => kinds.includes(e.kind) && e.status !== "archived").length : null;
  const base = `/worlds/${state.world.id}`;
  let body: React.ReactNode;
  switch (s.id) {
    case "map": body = <MapSection />; break;
    case "overview": body = <Overview />; break;
    case "atlas": body = <Atlas />; break;
    case "brain": body = <Brain />; break;
    case "guardian": body = <GuardianSection />; break;
    case "timeline": body = <Timeline />; break;
    case "collaboration": body = <Collaboration />; break;
    case "history": body = <History />; break;
    case "settings": body = <Settings />; break;
    default: body = <EntityList title={s.label} kinds={s.kinds!} intro={INTRO[s.id]} />;
  }
  return (
    <>
      <nav className="mobile-nav" aria-label="Sections du monde">{SECTIONS.map(x => <Link key={x.id} href={`${base}/${x.id}`} className={x.id === s.id ? "on" : ""}>{x.icon} {x.label}</Link>)}</nav>
      <div className="studio">
        <aside className="studio-nav" aria-label="Sections du monde">
          <div className="world-title"><h2 className="display">{state.world.name}</h2><div className="row wrap small" style={{ marginTop: 6 }}>{role && <span className="badge violet">{ROLE_LABEL[role]}</span>}<span className="faint">{now}</span></div></div>
          {SECTIONS.map((x, i) => (
            <div key={x.id}>
              {(i === 0 || SECTIONS[i - 1].group !== x.group) && <div className="nav-group">{x.group}</div>}
              <Link href={`${base}/${x.id}`} className={`nav-item ${x.id === s.id ? "on" : ""}`} data-testid={`nav-${x.id}`}><i>{x.icon}</i>{x.label}{count(x.kinds) !== null && <span className="count">{count(x.kinds)}</span>}</Link>
            </div>
          ))}
        </aside>
        <main className={`studio-main ${s.id === "map" ? "full" : ""}`}>{body}</main>
      </div>
    </>
  );
}

function StudioGate() {
  const params = useParams<{ id: string; section?: string[] }>();
  const { session } = useSession();
  const section = params.section?.[0] ?? "map";
  return (
    <WorldProvider key={`${params.id}:${session?.userId}`} worldId={params.id} fallback={<Loading label="Le monde s'éveille" />}
      error={msg => <main className="page"><Empty glyph="✕" title="Monde inaccessible"><p>{msg}</p><Link className="btn" href="/worlds">Retour à la bibliothèque</Link></Empty></main>}>
      <Studio section={section} />
    </WorldProvider>
  );
}

export default function WorldPage() {
  return <><TopBar /><RequireAuth><StudioGate /></RequireAuth></>;
}

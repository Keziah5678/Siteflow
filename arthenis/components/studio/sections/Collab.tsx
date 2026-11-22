"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeLawChange, checkDraft } from "@/lib/engine/guardian";
import { lawsAsText, normalizeConstitution } from "@/lib/engine/constitution";
import { KIND_LABEL } from "@/lib/engine/hierarchy";
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLE_RANK, canChangeRole } from "@/lib/engine/permissions";
import type { Activity, Constitution, Invitation, Proposal, Revision, Role } from "@/lib/engine/types";
import type { EntityInput as EntityInputLike } from "@/lib/data/repository";
import { Field, Modal, Spinner, errorMessage, useToast } from "../../ui";
import GuardianView from "../GuardianView";
import { useWorld } from "../WorldContext";

/* --------------------------------------------------------- collaboration */
export function Collaboration() {
  const { state, repo, can, role, userId } = useWorld();
  const toast = useToast();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Invitation["role"]>("contributor");
  const [reviewing, setReviewing] = useState<Proposal | null>(null);
  const load = async () => {
    try {
      const [p, a, i] = await Promise.all([repo.listProposals(state.world.id), repo.listActivity(state.world.id), can("manage_members") ? repo.listInvitations(state.world.id) : Promise.resolve([])]);
      setProposals(p); setActivity(a); setInvites(i);
    } catch (e) { toast(errorMessage(e), "error"); setProposals([]); }
  };
  useEffect(() => { load(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const assignable = (["admin", "guardian", "contributor", "reader"] as const).filter(r => role && ROLE_RANK[r] < ROLE_RANK[role]);
  const pending = (proposals ?? []).filter(p => p.status === "pending");

  return (
    <div className="stack">
      <div><span className="caps muted">Mondes partagés</span><h2>Collaboration</h2><p className="muted small">Mode de contribution : <b>{state.world.constitution.contribution.mode === "closed" ? "fermé" : state.world.constitution.contribution.mode === "open" ? "ouvert aux contributeurs" : "sur proposition"}</b>. Personne ne modifie un monde privé sans y avoir été invité.</p></div>
      <div className="split">
        <div className="panel stack">
          <h3>Membres</h3>
          <table className="list"><thead><tr><th>Membre</th><th>Rôle</th><th /></tr></thead><tbody>
            {state.members.map(m => (
              <tr key={m.userId}>
                <td>{m.displayName}{m.userId === userId && <span className="faint"> (vous)</span>}</td>
                <td>{role && m.role !== "creator" && can("manage_members") && ROLE_RANK[m.role] < ROLE_RANK[role] ? (
                  <select value={m.role} style={{ width: "auto" }} onChange={async e => { const next = e.target.value as Exclude<Role, "creator">; if (!canChangeRole(role, m.role, next)) return toast("Changement non autorisé.", "error"); try { await repo.setMemberRole(state.world.id, m.userId, next); toast("Rôle mis à jour.", "success"); } catch (err) { toast(errorMessage(err), "error"); } }}>
                    {[m.role, ...assignable.filter(r => r !== m.role)].map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ) : <span className="badge violet">{ROLE_LABEL[m.role]}</span>}</td>
                <td>{m.role !== "creator" && (m.userId === userId || (role && can("manage_members") && ROLE_RANK[m.role] < ROLE_RANK[role])) && <button className="btn ghost sm" onClick={async () => { try { await repo.removeMember(state.world.id, m.userId); } catch (err) { toast(errorMessage(err), "error"); } }}>{m.userId === userId ? "Quitter" : "Retirer"}</button>}</td>
              </tr>
            ))}
          </tbody></table>
          {can("manage_members") && (
            <form className="stack" onSubmit={async e => { e.preventDefault(); try { await repo.invite(state.world.id, email, inviteRole); setEmail(""); toast("Invitation envoyée. La personne la verra dans sa bibliothèque.", "success"); load(); } catch (err) { toast(errorMessage(err), "error"); } }}>
              <span className="caps muted">Inviter</span>
              <div className="row wrap"><input data-testid="invite-email" style={{ flex: 1, minWidth: 200 }} type="email" placeholder="adresse@exemple.com" value={email} onChange={e => setEmail(e.target.value)} /><select style={{ width: "auto" }} value={inviteRole} onChange={e => setInviteRole(e.target.value as Invitation["role"])}>{assignable.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select><button className="btn primary" data-testid="invite-send" disabled={!email.trim()}>Inviter</button></div>
              <span className="small faint">{ROLE_DESCRIPTION[inviteRole]}</span>
              {invites.filter(i => i.status === "pending").map(i => <div key={i.id} className="row between small"><span>{i.email} · {ROLE_LABEL[i.role]} · en attente</span><button type="button" className="btn ghost sm" onClick={() => repo.revokeInvitation(i.id).then(load)}>Révoquer</button></div>)}
            </form>
          )}
        </div>
        <div className="panel stack" data-testid="proposals">
          <h3>Propositions {pending.length > 0 && <span className="badge warning">{pending.length} en attente</span>}</h3>
          {!proposals ? <Spinner /> : proposals.length === 0 ? <span className="muted small">Aucune proposition.</span> : proposals.map(p => {
            const ent = p.payload.entity as EntityInputLike | undefined;
            return (
              <div key={p.id} className="issue">
                <div className="row between wrap"><b>{ent?.name ?? p.action}</b><span className={`badge ${p.status === "approved" ? "valid" : p.status === "rejected" ? "conflict" : ""}`}>{p.status}</span></div>
                <span className="small muted">{p.authorName} · {ent?.kind ? KIND_LABEL[ent.kind] : p.action} · Guardian : {p.guardian?.verdict ?? "—"}</span>
                {p.reviewNote && <span className="small">Note : {p.reviewNote}</span>}
                <div className="row">
                  {p.status === "pending" && can("review") && <button className="btn sm primary" data-testid="proposal-review" onClick={() => setReviewing(p)}>Examiner</button>}
                  {p.status === "pending" && p.authorId === userId && <button className="btn sm ghost" onClick={() => repo.withdrawProposal(p.id).then(load).catch(err => toast(errorMessage(err), "error"))}>Retirer</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel stack"><h3>Journal d&apos;activité</h3>
        {activity.length === 0 ? <span className="muted small">Aucune activité.</span> : activity.slice(0, 60).map(a => <div key={a.id} className="row between small"><span><b>{a.actorName}</b> — {a.summary}</span><span className="faint">{new Date(a.createdAt).toLocaleString("fr-FR")}</span></div>)}
      </div>
      {reviewing && <Review p={reviewing} onClose={() => { setReviewing(null); load(); }} />}
    </div>
  );
}

function Review({ p, onClose }: { p: Proposal; onClose: () => void }) {
  const { state, repo } = useWorld();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ent = p.payload.entity as EntityInputLike & { kind: Parameters<typeof checkDraft>[0]["kind"] };
  // Re-checked now: the world may have changed since the proposal was written.
  const now = useMemo(() => ent ? checkDraft({ kind: ent.kind, name: ent.name ?? "", summary: ent.summary ?? "", parentId: ent.parentId ?? null, data: ent.data ?? {}, x: ent.x, y: ent.y }, { constitution: state.world.constitution, entities: state.entities, events: state.events, tick: state.world.tick }, { selfId: ent.id }) : null, [ent, state]);
  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await repo.reviewProposal(p.id, approve, note);
      if (approve && ent) await repo.addEvent(state.world.id, { tick: state.world.tick, title: `${KIND_LABEL[ent.kind]} : ${ent.name}`, description: ent.summary ?? "", kind: "creation", entityIds: [], consequences: [`Proposé par ${p.authorName}`], source: "contributor" });
      toast(approve ? "Proposition intégrée au canon." : "Proposition refusée.", "success");
      onClose();
    } catch (e) { toast(errorMessage(e), "error"); setBusy(false); }
  };
  return (
    <Modal title={`Proposition de ${p.authorName}`} onClose={onClose} footer={<><button className="btn danger" disabled={busy} onClick={() => decide(false)}>Refuser</button><button className="btn primary" data-testid="proposal-approve" disabled={busy || now?.verdict === "CONFLICT"} onClick={() => decide(true)}>Accepter</button></>}>
      {ent && <><b>{KIND_LABEL[ent.kind]} « {ent.name} »</b><p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{ent.summary}</p></>}
      {typeof p.payload.justification === "string" && <div className="notice small">Justification : {p.payload.justification}</div>}
      {now && <><span className="caps muted">Guardian, maintenant</span><GuardianView report={now} compact /></>}
      <Field label="Note au contributeur"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

/* --------------------------------------------------------------- history */
export function History() {
  const { state, repo, byId } = useWorld();
  const [revs, setRevs] = useState<Revision[] | null>(null);
  useEffect(() => { repo.listRevisions(state.world.id).then(setRevs).catch(() => setRevs([])); }, [repo, state]);
  return (
    <div className="stack">
      <div><span className="caps muted">Versionnage</span><h2>Révisions</h2><p className="muted small">Chaque création, modification, correction, simulation et amendement laisse une révision immuable. Rien n&apos;est supprimé.</p></div>
      <div className="panel">
        {!revs ? <Spinner /> : <table className="list"><thead><tr><th>Quand</th><th>Quoi</th><th>Type</th><th>Motif</th></tr></thead><tbody>
          {revs.slice(0, 300).map(r => <tr key={r.id}><td className="small faint">{new Date(r.createdAt).toLocaleString("fr-FR")}</td><td>{r.targetType === "constitution" ? "Constitution" : r.targetType === "event" ? "Événement" : byId.get(r.targetId)?.name ?? "—"} <span className="faint small">v{r.version}</span></td><td><span className="badge">{r.changeType}</span></td><td className="small muted">{r.reason}</td></tr>)}
        </tbody></table>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- settings */
export function Settings() {
  const { state, repo, can } = useWorld();
  const toast = useToast();
  const router = useRouter();
  const w = state.world;
  const [name, setName] = useState(w.name);
  const [description, setDescription] = useState(w.description);
  const [draft, setDraft] = useState<Constitution>(() => structuredClone(w.constitution));
  const [reason, setReason] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const impact = useMemo(() => analyzeLawChange(w.constitution, normalizeConstitution(draft), { entities: state.entities, events: state.events, tick: w.tick }), [w.constitution, draft, state.entities, state.events, w.tick]);
  const set = <K extends keyof Constitution>(k: K, v: Constitution[K]) => setDraft(d => ({ ...d, [k]: v }));
  const changed = impact.changes.length > 0;

  return (
    <div className="stack">
      <div><span className="caps muted">Paramètres du monde</span><h2>{w.name}</h2></div>
      {can("simulate") && (
        <form className="panel stack" onSubmit={async e => { e.preventDefault(); try { await repo.updateWorld(w.id, { name: name.trim() || w.name, description }); toast("Monde mis à jour.", "success"); } catch (err) { toast(errorMessage(err), "error"); } }}>
          <h3>Identité</h3>
          <Field label="Nom"><input value={name} onChange={e => setName(e.target.value)} maxLength={120} /></Field>
          <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
          <div><button className="btn primary">Enregistrer</button></div>
        </form>
      )}

      <div className="panel stack" data-testid="amendment">
        <h3>Constitution {can("amend_laws") ? "— amendement" : ""}</h3>
        {!can("amend_laws") ? lawsAsText(w.constitution).map(l => <div key={l.key} className="small"><b>{l.title}</b> — <span className="muted">{l.text}</span></div>) : (<>
          <p className="small muted">Vous êtes l&apos;autorité suprême de ce monde. Un amendement est historisé (avant/après), inscrit dans la chronologie, et Guardian analyse ses conséquences sur tout le canon. Aucun élément n&apos;est supprimé : ceux qui contredisent les nouvelles lois sont marqués « en tension ».</p>
          <div className="grid cols-2">
            <label className="toggle"><input type="checkbox" data-testid="amend-magic" checked={draft.magic.allowed} onChange={e => set("magic", { ...draft.magic, allowed: e.target.checked })} /><span><b>Magie</b></span></label>
            <label className="toggle"><input type="checkbox" checked={draft.creatures.fictional} onChange={e => set("creatures", { ...draft.creatures, fictional: e.target.checked })} /><span><b>Créatures fictives</b></span></label>
            <label className="toggle"><input type="checkbox" checked={draft.creatures.deities} onChange={e => set("creatures", { ...draft.creatures, deities: e.target.checked })} /><span><b>Divinités</b></span></label>
            <label className="toggle"><input type="checkbox" checked={draft.npcs.allowed} onChange={e => set("npcs", { allowed: e.target.checked })} /><span><b>PNJ</b></span></label>
            <label className="toggle"><input type="checkbox" checked={draft.physics.ftl} onChange={e => set("physics", { ...draft.physics, ftl: e.target.checked })} /><span><b>Supraluminique</b></span></label>
            <label className="toggle"><input type="checkbox" checked={draft.blank} onChange={e => set("blank", e.target.checked)} /><span><b>Carte à révéler (univers vierge)</b></span></label>
          </div>
          <Field label={`Technologie maximale : ${draft.technology.maxLevel}/10`}><input type="range" min={0} max={10} value={draft.technology.maxLevel} onChange={e => set("technology", { ...draft.technology, maxLevel: Number(e.target.value) })} /></Field>
          <div className="grid cols-2">
            <Field label="Réalisme"><select value={draft.realism} onChange={e => set("realism", e.target.value as Constitution["realism"])}><option value="strict">Strict</option><option value="plausible">Plausible</option><option value="libre">Libre</option></select></Field>
            <Field label="Contribution"><select value={draft.contribution.mode} onChange={e => set("contribution", { ...draft.contribution, mode: e.target.value as Constitution["contribution"]["mode"] })}><option value="closed">Fermée</option><option value="proposals">Sur proposition</option><option value="open">Ouverte</option></select></Field>
          </div>
          {changed && (
            <div className="stack" data-testid="law-impact">
              <span className="caps muted">Analyse d&apos;impact</span>
              {impact.changes.map(c => <div key={c} className="small">• {c}</div>)}
              {impact.newlyConflicting.length > 0 ? <div className="notice warning small">{impact.newlyConflicting.length} élément(s) entreraient en tension : {impact.newlyConflicting.map(x => `${x.name} (${x.issues[0]?.message})`).join(" · ")}</div> : <div className="notice valid small">Aucun élément existant ne contredit ces nouvelles lois.</div>}
              {impact.resolved.length > 0 && <div className="small muted">Tensions levées : {impact.resolved.map(x => x.name).join(", ")}</div>}
              <Field label="Motif de l'amendement (obligatoire)"><input data-testid="amend-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Les anciens dieux se réveillent" /></Field>
              <div className="row"><button className="btn primary" data-testid="amend-submit" disabled={!reason.trim()} onClick={async () => { try { const v = await repo.amendConstitution(w.id, normalizeConstitution(draft), reason, impact); toast(`Constitution v${v} en vigueur.`, "success"); setReason(""); } catch (err) { toast(errorMessage(err), "error"); } }}>Promulguer l&apos;amendement</button><button className="btn ghost" onClick={() => setDraft(structuredClone(w.constitution))}>Annuler les changements</button></div>
            </div>
          )}
        </>)}
      </div>

      {can("manage_world") && (
        <div className="panel stack">
          <h3>Visibilité et archivage</h3>
          <label className="toggle"><input type="checkbox" checked={w.visibility === "public"} onChange={async e => { try { await repo.updateWorld(w.id, { visibility: e.target.checked ? "public" : "private" }); } catch (err) { toast(errorMessage(err), "error"); } }} /><span><b>Monde public</b><span className="small muted">Lisible par tous ; seuls les membres contribuent.</span></span></label>
          {!confirmArchive ? <div><button className="btn danger" onClick={() => setConfirmArchive(true)}>Archiver ce monde</button></div> : (
            <div className="notice conflict stack"><span>Le monde disparaîtra de la bibliothèque. Ses données sont conservées (aucune suppression). Confirmer ?</span><div className="row"><button className="btn danger" onClick={async () => { await repo.archiveWorld(w.id); router.replace("/worlds"); }}>Archiver</button><button className="btn ghost" onClick={() => setConfirmArchive(false)}>Annuler</button></div></div>
          )}
        </div>
      )}
    </div>
  );
}


"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, LogOut, MessageCircle, UserMinus, X } from "lucide-react";
import { Avatar, Badge, Notice, SectionTitle, Tag } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { decideApplicationAction, removeMemberAction, updateMemberAction } from "@/lib/actions/projects";
import { startConversationAction } from "@/lib/actions/social";
import { timeAgo } from "@/lib/utils";
import type { MatchResult } from "@/lib/matching";

export type TeamMember = { user_id: string; role: "owner" | "admin" | "member"; responsibility: string | null; display_name: string; username: string; avatar_url: string | null; skills: string[] };
export type ApplicationRow = { id: string; skill: string | null; message: string; created_at: string; applicant: { id: string; username: string; display_name: string; avatar_url: string | null; skills: string[] } | null };

export function TeamPanel({ projectId, members, applications, viewerId, viewerRole, matches, missing }: { projectId: string; members: TeamMember[]; applications: ApplicationRow[]; viewerId: string; viewerRole: "owner" | "admin" | "member"; matches: MatchResult[] | null; missing: string[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const isManager = viewerRole !== "member";
  const run = (fn: () => Promise<{ error?: string } | null>) => start(async () => { const r = await fn(); setErr(r?.error ?? null); });

  return (
    <div className="space-y-8">
      {err && <Notice tone="danger">{err}</Notice>}
      {isManager && (
        <section>
          <SectionTitle>Candidatures en attente ({applications.length})</SectionTitle>
          {applications.length === 0 ? (
            <p className="text-sm text-muted">Aucune candidature en attente.</p>
          ) : (
            <ul className="space-y-3">
              {applications.map((a) => (
                <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.applicant?.display_name ?? "?"} src={a.applicant?.avatar_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/u/${a.applicant?.username}`} className="text-sm font-medium hover:underline">{a.applicant?.display_name}</Link>
                      <p className="text-[12px] text-subtle">{a.skill ? `Propose : ${a.skill} · ` : ""}{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{a.message}</p>
                  {a.applicant && a.applicant.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{a.applicant.skills.slice(0, 8).map((s) => <Tag key={s}>{s}</Tag>)}</div>}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => run(() => decideApplicationAction(a.id, true, projectId))}><Check /> Accepter</Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => decideApplicationAction(a.id, false, projectId))}><X /> Refuser</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <SectionTitle>Équipe et responsabilités</SectionTitle>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <Avatar name={m.display_name} src={m.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${m.username}`} className="text-sm font-medium hover:underline">{m.display_name}</Link>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge tone={m.role === "owner" ? "primary" : "neutral"}>{m.role === "owner" ? "Créateur" : m.role === "admin" ? "Administrateur" : "Membre"}</Badge>
                  {!isManager && m.responsibility && <span className="text-[12px] text-muted">{m.responsibility}</span>}
                </div>
              </div>
              {isManager && (
                <input
                  defaultValue={m.responsibility ?? ""}
                  maxLength={120}
                  placeholder="Responsabilité"
                  aria-label={`Responsabilité de ${m.display_name}`}
                  onBlur={(e) => { if (e.target.value !== (m.responsibility ?? "")) run(() => updateMemberAction(projectId, m.user_id, { responsibility: e.target.value || null })); }}
                  className="h-8 w-full rounded-lg border border-border bg-bg-2 px-2.5 text-[13px] sm:w-48"
                />
              )}
              <div className="flex items-center gap-1">
                {m.user_id !== viewerId && (
                  <Button size="sm" variant="ghost" aria-label={`Écrire à ${m.display_name}`} disabled={pending} onClick={() => run(() => startConversationAction(m.user_id))}><MessageCircle /></Button>
                )}
                {viewerRole === "owner" && m.role !== "owner" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateMemberAction(projectId, m.user_id, { role: m.role === "admin" ? "member" : "admin" }))}>
                    {m.role === "admin" ? "Retirer admin" : "Nommer admin"}
                  </Button>
                )}
                {isManager && m.role !== "owner" && m.user_id !== viewerId && (viewerRole === "owner" || m.role === "member") && (
                  <Button size="sm" variant="ghost" aria-label={`Retirer ${m.display_name}`} disabled={pending} onClick={() => { if (confirm(`Retirer ${m.display_name} de l'équipe ?`)) run(() => removeMemberAction(projectId, m.user_id)); }}><UserMinus /></Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {viewerRole !== "owner" && (
          <Button size="sm" variant="ghost" className="mt-3 text-danger" disabled={pending} onClick={() => { if (confirm("Quitter l'équipe de ce projet ?")) run(() => removeMemberAction(projectId, viewerId)); }}>
            <LogOut /> Quitter l'équipe
          </Button>
        )}
      </section>

      {isManager && matches && (
        <section>
          <SectionTitle>Profils compatibles</SectionTitle>
          {missing.length > 0 && <p className="mb-3 text-[13px] text-muted">Compétences non couvertes par l'équipe : {missing.join(", ")}.</p>}
          {matches.length === 0 ? (
            <p className="text-sm text-muted">Aucun membre découvrable ne correspond encore aux besoins du projet. Les recommandations s'enrichissent à mesure que la communauté grandit.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {matches.map((r) => (
                <li key={r.candidate.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.candidate.display_name} src={r.candidate.avatar_url} size={36} />
                    <div className="min-w-0">
                      <Link href={`/u/${r.candidate.username}`} className="block truncate text-sm font-medium hover:underline">{r.candidate.display_name}</Link>
                      <p className="text-[12px] text-subtle">{r.candidate.city ?? ""}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-[12px] text-muted">
                    {r.reasons.slice(0, 3).map((x) => <li key={x}>• {x}</li>)}
                  </ul>
                  <Link href={`/u/${r.candidate.username}?contact=1`} className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-[13px] font-medium hover:bg-card-hover">
                    <MessageCircle className="size-4" /> Contacter
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-subtle">Recommandations fondées sur les compétences, intérêts, disponibilités et la proximité déclarés. Elles ne garantissent pas la réussite d'une collaboration.</p>
        </section>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ShieldCheck, AlertCircle, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { formatDateTime, cn } from "@/lib/utils";
import type { AuditIssue, AuditScores, SeoAudit } from "@/lib/types";

const CATEGORY_LABELS: Record<keyof Omit<AuditScores, "overall">, string> = {
  design: "Design",
  content: "Contenu",
  seo: "SEO",
  responsive: "Responsive",
  accessibility: "Accessibilité",
  performance: "Performance",
  security: "Sécurité",
  conversion: "Conversion",
  consistency: "Cohérence",
};

function scoreColor(score: number) {
  if (score >= 85) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-danger";
}

const SEVERITY_ICON = { info: Info, warning: AlertTriangle, critical: ShieldAlert };
const SEVERITY_TONE = { info: "neutral", warning: "warning", critical: "danger" } as const;

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div className={cn("h-full rounded-full transition-all", scoreColor(value))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function AuditPanel({ projectId, initialAudit }: { projectId: string; initialAudit: SeoAudit | null }) {
  const [audit, setAudit] = useState(initialAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/audit`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "L'audit a échoué.");
      setAudit(body.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'audit a échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Audit du site</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design, contenu, SEO, responsive, accessibilité, performance, sécurité, conversion, cohérence.
          </p>
        </div>
        <Button onClick={runAudit} loading={loading}>
          <ShieldCheck className="h-4 w-4" />
          Lancer un audit
        </Button>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      {!audit ? (
        <EmptyState
          icon={ShieldCheck}
          title="Aucun audit n'a encore été lancé"
          description="Lancez un audit pour détecter les problèmes de design, SEO, accessibilité et conversion."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Score global : {audit.scores.overall}/100</CardTitle>
              <p className="text-xs text-muted-foreground">Dernier audit : {formatDateTime(audit.created_at)}</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((key) => (
                <ScoreBar key={key} label={CATEGORY_LABELS[key]} value={audit.scores[key]} />
              ))}
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 font-display text-lg font-medium">
              Problèmes détectés ({audit.issues.length})
            </h2>
            {audit.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun problème détecté. Excellent travail.</p>
            ) : (
              <StaggerGroup className="space-y-3">
                {(audit.issues as AuditIssue[])
                  .slice()
                  .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1))
                  .map((issue, i) => {
                    const Icon = SEVERITY_ICON[issue.severity];
                    return (
                      <StaggerItem key={i}>
                        <div className="flex gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{issue.title}</p>
                              <Badge tone={SEVERITY_TONE[issue.severity]}>{CATEGORY_LABELS[issue.category]}</Badge>
                              {issue.auto_fixable ? <Badge tone="success">corrigible</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            {issue.suggestion ? (
                              <p className="text-sm text-accent">→ {issue.suggestion}</p>
                            ) : null}
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
              </StaggerGroup>
            )}
          </div>
        </>
      )}
    </div>
  );
}

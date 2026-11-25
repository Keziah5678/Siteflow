"use client";
import { useState, useTransition } from "react";
import { STATUSES, type ProjectStatus } from "@/lib/constants";
import { setProjectStatusAction } from "@/lib/actions/projects";

export function StatusSelect({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor="project-status" className="sr-only">Statut du projet</label>
      <select
        id="project-status"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ProjectStatus;
          setValue(next);
          start(async () => {
            const r = await setProjectStatusAction(projectId, next);
            if (r?.error) { setErr(r.error); setValue(status); }
          });
        }}
        className="h-8 rounded-xl border border-border bg-card px-3 text-[13px]"
      >
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
    </div>
  );
}

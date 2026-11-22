"use client";
import type { GuardianReport } from "@/lib/engine/types";

const SEAL = { VALID: "✓", WARNING: "!", CONFLICT: "✕" } as const;
const LABEL = { VALID: "Compatible avec l'univers", WARNING: "Possible, mais à expliquer", CONFLICT: "Contradiction avec les lois ou l'histoire" } as const;

export default function GuardianView({ report, onAlternative, compact }: { report: GuardianReport; onAlternative?: (alt: string) => void; compact?: boolean }) {
  return (
    <div className="stack" data-testid="guardian-report" data-verdict={report.verdict}>
      <div className={`verdict ${report.verdict}`}>
        <div className="seal">{SEAL[report.verdict]}</div>
        <div>
          <div className="row wrap"><b data-testid="guardian-verdict">{report.verdict}</b><span className="badge">{report.engine === "rules+ai" ? "Règles + IA" : "Moteur de règles"}</span></div>
          <span className="small muted">{LABEL[report.verdict]}</span>
        </div>
      </div>
      {report.issues.map((i, k) => (
        <div key={k} className={`issue ${i.severity}`}>
          <span>{i.message}</span>
          {i.reference && <span className="ref">Loi / fait établi : {i.reference}</span>}
          {i.suggestion && <span className="small">→ {i.suggestion}</span>}
        </div>
      ))}
      {!compact && report.alternatives.length > 0 && (
        <div className="stack tight">
          <span className="caps muted">Alternatives compatibles</span>
          <div className="chips">{report.alternatives.map(a => <button type="button" key={a} className="chip" onClick={() => onAlternative?.(a)}>{a}</button>)}</div>
        </div>
      )}
      {!compact && report.consequences.length > 0 && (
        <div className="stack tight">
          <span className="caps muted">Conséquences prévues</span>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{report.consequences.map(c => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

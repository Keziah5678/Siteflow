/**
 * CSV import: RFC 4180 parsing (quotes, escaped quotes, newlines in fields),
 * `;` or `,` separators (French Excel exports use `;`), header detection in
 * French or English, row validation. Pure and unit-tested.
 */

export type ImportRow = {
  firstName: string; lastName: string; company: string; email: string | null; phone: string | null;
  need: string; estimatedValueCents: number | null; status: string | null;
};

export type ImportResult = { rows: ImportRow[]; errors: Array<{ line: number; message: string }>; columns: Record<string, string> };

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : (firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",");
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"' && field === "") inQuotes = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f.trim() !== "")) rows.push(row);
  return rows;
}

const HEADERS: Record<keyof ImportRow, RegExp> = {
  firstName: /^(prenom|first.?name|firstname)$/,
  lastName: /^(nom|nom de famille|last.?name|lastname|surname)$/,
  company: /^(societe|entreprise|raison sociale|company|organisation|organization)$/,
  email: /^(e.?mail|courriel|adresse e.?mail|mail)$/,
  phone: /^(telephone|tel|phone|mobile|portable)$/,
  need: /^(besoin|demande|message|description|need|notes?|objet)$/,
  estimatedValueCents: /^(montant|valeur|budget|montant estime|amount|value)$/,
  status: /^(statut|status|etape)$/
};

const STATUS_MAP: Record<string, string> = {
  nouveau: "new", new: "new", "a contacter": "to_contact", "en attente": "waiting", "a relancer": "to_follow_up",
  "rendez-vous obtenu": "meeting", rdv: "meeting", "client gagne": "won", gagne: "won", won: "won", "client perdu": "lost", perdu: "lost", lost: "lost"
};

const n = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_-]+/g, " ");

export function mapRows(table: string[][], maxRows = 5000): ImportResult {
  const errors: ImportResult["errors"] = [];
  if (!table.length) return { rows: [], errors: [{ line: 1, message: "Fichier vide." }], columns: {} };
  const header = table[0].map(n);
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  const columns: Record<string, string> = {};
  header.forEach((h, i) => {
    for (const [k, re] of Object.entries(HEADERS) as [keyof ImportRow, RegExp][]) if (idx[k] === undefined && re.test(h)) { idx[k] = i; columns[k] = table[0][i]; }
  });
  if (idx.email === undefined && idx.phone === undefined) errors.push({ line: 1, message: "Colonne e-mail ou téléphone introuvable (en-têtes attendus : prénom, nom, entreprise, email, téléphone, besoin, montant)." });
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  for (let li = 1; li < table.length && rows.length < maxRows; li++) {
    const r = table[li];
    const get = (k: keyof ImportRow) => (idx[k] !== undefined ? (r[idx[k]!] ?? "").trim() : "");
    const email = get("email").toLowerCase() || null;
    const phone = get("phone") || null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push({ line: li + 1, message: `E-mail invalide : ${email}` }); continue; }
    if (!email && !phone) { errors.push({ line: li + 1, message: "Ni e-mail ni téléphone." }); continue; }
    if (email && seen.has(email)) { errors.push({ line: li + 1, message: `Doublon dans le fichier : ${email}` }); continue; }
    if (email) seen.add(email);
    const rawValue = get("estimatedValueCents").replace(/[€\s]/g, "").replace(",", ".");
    const value = rawValue && !Number.isNaN(Number(rawValue)) ? Math.round(Number(rawValue) * 100) : null;
    rows.push({
      firstName: get("firstName").slice(0, 100), lastName: get("lastName").slice(0, 100), company: get("company").slice(0, 160),
      email, phone: phone?.slice(0, 40) ?? null, need: get("need").slice(0, 4000), estimatedValueCents: value && value >= 0 ? value : null,
      status: STATUS_MAP[n(get("status"))] ?? null
    });
  }
  if (table.length - 1 > maxRows) errors.push({ line: maxRows + 2, message: `Import limité à ${maxRows} lignes par fichier.` });
  return { rows, errors, columns };
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // spreadsheet formula injection
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [keys.join(";"), ...rows.map(r => keys.map(k => cell(r[k])).join(";"))].join("\r\n");
}

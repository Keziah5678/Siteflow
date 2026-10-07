import { pad2 } from './format';

/** ISO → "AAAA-MM-JJ HH:mm" (heure locale) pour la saisie admin. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "AAAA-MM-JJ HH:mm" (heure locale) → ISO, ou null si invalide. */
export function fromLocalInput(value: string): string | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

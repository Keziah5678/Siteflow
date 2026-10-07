const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value).replace(/ | /g, ' ');
}

/** 12341 → "12,3K" ; 1100 → "1,1K" */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1).replace('.', ',').replace(',0', '')}K`;
  return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}M`;
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function discountOf(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const longDateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hourLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Aujourd'hui 20h", "Demain 18h", "Samedi 10h", "12 octobre 18h" */
export function formatDropMoment(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (diffDays === 0) return `Aujourd’hui ${hourLabel(d)}`;
  if (diffDays === 1) return `Demain ${hourLabel(d)}`;
  if (diffDays === -1) return `Hier ${hourLabel(d)}`;
  if (diffDays > 1 && diffDays < 7) return `${capitalize(dayFormatter.format(d))} ${hourLabel(d)}`;
  return `${dateFormatter.format(d)} ${hourLabel(d)}`;
}

export function formatDate(iso: string): string {
  return longDateFormatter.format(new Date(iso));
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604_800) return `il y a ${Math.floor(diff / 86_400)} j`;
  return formatDate(iso);
}

export function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

import { useEffect, useState } from 'react';

/**
 * Horloge partagée (une seule minuterie pour toute l'app) : les comptes à
 * rebours et les statuts de drops se mettent à jour automatiquement.
 */
type Listener = (now: number) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: Listener) {
  listeners.add(listener);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l(Date.now())), 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => (enabled ? subscribe(setNow) : undefined), [enabled]);
  return now;
}

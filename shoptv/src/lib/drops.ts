import type { Drop, DropStatus } from '@/types/models';

/** Statut calculé à partir des dates : il change automatiquement à l'échéance. */
export function getDropStatus(drop: Pick<Drop, 'startsAt' | 'endsAt'>, now = Date.now()): DropStatus {
  const start = new Date(drop.startsAt).getTime();
  const end = new Date(drop.endsAt).getTime();
  if (now < start) return 'upcoming';
  if (now < end) return 'live';
  return 'ended';
}

/** Instant cible du compte à rebours : début si à venir, fin si en cours. */
export function getDropTarget(drop: Pick<Drop, 'startsAt' | 'endsAt'>, now = Date.now()): number | null {
  const status = getDropStatus(drop, now);
  if (status === 'upcoming') return new Date(drop.startsAt).getTime();
  if (status === 'live') return new Date(drop.endsAt).getTime();
  return null;
}

export const DROP_STATUS_LABEL: Record<DropStatus, string> = {
  live: 'En cours',
  upcoming: 'À venir',
  ended: 'Terminé',
};

import { useCallback } from 'react';

import { toast } from '@/components/ui/Toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cancelDropReminder, scheduleDropReminder } from '@/services/notifications';
import { toggleDropFollow } from '@/services/user-data';
import { useLibrary } from '@/store/library';
import type { Drop } from '@/types/models';

/** « Me le rappeler » : suivi du drop (compte requis) + rappel local programmé. */
export function useDropReminder() {
  const requireAuth = useRequireAuth();
  const followed = useLibrary((s) => s.followedDrops);

  const toggle = useCallback(
    (drop: Drop) =>
      requireAuth(async () => {
        try {
          const following = await toggleDropFollow(drop.id);
          if (following) {
            await scheduleDropReminder(drop).catch(() => undefined);
            toast(`On te prévient pour ${drop.title} 🔔`, 'success');
          } else {
            await cancelDropReminder(drop.id);
            toast('Rappel désactivé');
          }
        } catch {
          toast('Impossible de modifier le rappel.', 'error');
        }
      }, 'drop'),
    [requireAuth],
  );

  return { isFollowing: (id: string) => followed.includes(id), toggle };
}

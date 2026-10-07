import { router } from 'expo-router';
import { useCallback } from 'react';

import { useSession } from '@/store/session';

/**
 * Exécute l'action si l'utilisateur est connecté, sinon ouvre la connexion.
 * La navigation (découverte, vidéos, produits) reste libre sans compte.
 */
export function useRequireAuth() {
  return useCallback(<T,>(action: () => T, reason?: string): T | undefined => {
    if (useSession.getState().status === 'signedIn') return action();
    router.push({ pathname: '/login', params: reason ? { reason } : {} });
    return undefined;
  }, []);
}

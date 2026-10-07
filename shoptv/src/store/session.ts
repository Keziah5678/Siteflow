import { create } from 'zustand';

import type { Profile } from '@/types/models';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: AuthStatus;
  userId: string | null;
  profile: Profile | null;
  /** Vrai si l'utilisateur est un compte local (mode démo, sans Supabase). */
  isDemo: boolean;
  setSignedIn: (profile: Profile, isDemo?: boolean) => void;
  setProfile: (profile: Profile) => void;
  setSignedOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  userId: null,
  profile: null,
  isDemo: false,
  setSignedIn: (profile, isDemo = false) => set({ status: 'signedIn', userId: profile.id, profile, isDemo }),
  setProfile: (profile) => set({ profile }),
  setSignedOut: () => set({ status: 'signedOut', userId: null, profile: null, isDemo: false }),
}));

export const selectIsSignedIn = (s: SessionState) => s.status === 'signedIn';
export const selectIsAdmin = (s: SessionState) => s.profile?.role === 'admin';

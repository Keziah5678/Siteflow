import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { FavoriteKind, FavoriteRef, UserEvent } from '@/types/models';

import { persistStorage } from './storage';

const MAX_EVENTS = 300;

interface LibraryState {
  favorites: FavoriteRef[];
  likes: string[];
  followedDrops: string[];
  /** Historique local utilisé par la recommandation (aussi envoyé à Supabase si connecté). */
  events: UserEvent[];
  hasSeenOnboarding: boolean;
  recentSearches: string[];
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  isFavorite: (productId: string, kind?: FavoriteKind) => boolean;
  setFavorite: (productId: string, kind: FavoriteKind, value: boolean) => void;
  setLike: (productId: string, value: boolean) => void;
  setFollow: (dropId: string, value: boolean) => void;
  pushEvent: (event: Omit<UserEvent, 'at'>) => void;
  hydrateFromServer: (data: { favorites: FavoriteRef[]; likes: string[]; followedDrops: string[] }) => void;
  resetUserData: () => void;
  completeOnboarding: () => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      likes: [],
      followedDrops: [],
      events: [],
      hasSeenOnboarding: false,
      recentSearches: [],
      addRecentSearch: (term) => {
        const t = term.trim();
        if (t.length < 2) return;
        set({ recentSearches: [t, ...get().recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      isFavorite: (productId, kind = 'product') => get().favorites.some((f) => f.productId === productId && f.kind === kind),
      setFavorite: (productId, kind, value) => {
        const rest = get().favorites.filter((f) => !(f.productId === productId && f.kind === kind));
        set({ favorites: value ? [{ productId, kind }, ...rest] : rest });
      },
      setLike: (productId, value) => {
        const rest = get().likes.filter((id) => id !== productId);
        set({ likes: value ? [productId, ...rest] : rest });
      },
      setFollow: (dropId, value) => {
        const rest = get().followedDrops.filter((id) => id !== dropId);
        set({ followedDrops: value ? [dropId, ...rest] : rest });
      },
      pushEvent: (event) => set({ events: [{ ...event, at: Date.now() }, ...get().events].slice(0, MAX_EVENTS) }),
      hydrateFromServer: (data) => set(data),
      resetUserData: () => set({ favorites: [], likes: [], followedDrops: [] }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
    }),
    { name: 'shoptv-library', storage: persistStorage },
  ),
);

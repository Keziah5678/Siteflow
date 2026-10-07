import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AppNotification, NotificationSettings, Order, Profile } from '@/types/models';

import { persistStorage } from './storage';

/**
 * Données du compte local en MODE DÉMO (aucun Supabase configuré).
 * Permet de tester commandes, notifications et profil hors connexion.
 */
interface DemoAccountState {
  profile: Profile | null;
  orders: Order[];
  notifications: AppNotification[];
  settings: NotificationSettings;
  setProfile: (p: Profile | null) => void;
  addOrder: (o: Order) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  addNotification: (n: AppNotification) => void;
  setNotifications: (n: AppNotification[]) => void;
  setSettings: (s: NotificationSettings) => void;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  drops: true,
  priceDrops: true,
  orders: true,
  promotions: false,
};

export const useDemoAccount = create<DemoAccountState>()(
  persist(
    (set, get) => ({
      profile: null,
      orders: [],
      notifications: [],
      settings: DEFAULT_NOTIFICATION_SETTINGS,
      setProfile: (profile) => set({ profile }),
      addOrder: (o) => set({ orders: [o, ...get().orders] }),
      updateOrder: (id, patch) => set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
      addNotification: (n) => set({ notifications: [n, ...get().notifications].slice(0, 100) }),
      setNotifications: (notifications) => set({ notifications }),
      setSettings: (settings) => set({ settings }),
    }),
    { name: 'shoptv-demo-account', storage: persistStorage },
  ),
);

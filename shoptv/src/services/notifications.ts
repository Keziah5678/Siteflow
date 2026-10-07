import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { uid } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useDemoAccount } from '@/store/demo-account';
import { useSession } from '@/store/session';
import type { AppNotification, Drop, NotificationSettings, NotificationType } from '@/types/models';

import { mapNotification } from './mappers';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function useLocalStore(): boolean {
  return !supabase || useSession.getState().isDemo;
}

export async function listNotifications(): Promise<AppNotification[]> {
  if (!useSession.getState().userId) return [];
  if (useLocalStore()) return useDemoAccount.getState().notifications;
  const { data, error } = await supabase!.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markAllNotificationsRead(): Promise<void> {
  const now = new Date().toISOString();
  if (useLocalStore()) {
    const store = useDemoAccount.getState();
    store.setNotifications(store.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    return;
  }
  const userId = useSession.getState().userId;
  if (!userId) return;
  await supabase!.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
}

/** Notification in-app locale (mode démo) — en production elles sont créées par les triggers SQL. */
export function pushLocalNotification(type: NotificationType, title: string, body: string, data: Record<string, string> = {}) {
  if (!useLocalStore()) return;
  useDemoAccount.getState().addNotification({ id: uid(), type, title, body, data, readAt: null, createdAt: new Date().toISOString() });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const local = useDemoAccount.getState().settings;
  const userId = useSession.getState().userId;
  if (useLocalStore() || !userId) return local;
  const { data } = await supabase!.from('user_preferences').select('notification_settings').eq('user_id', userId).maybeSingle();
  return { ...local, ...(data?.notification_settings ?? {}) };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  useDemoAccount.getState().setSettings(settings);
  const userId = useSession.getState().userId;
  if (useLocalStore() || !userId) return;
  const { error } = await supabase!.from('user_preferences').upsert({ user_id: userId, notification_settings: settings });
  if (error) throw error;
}

/** Demande la permission et enregistre le token push Expo dans le profil. */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!isNative || !Device.isDevice) return null;
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SHOPTV',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#8B2CFF',
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null; // Push distant : nécessite un projet EAS (voir README).
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const userId = useSession.getState().userId;
    if (supabase && userId && !useSession.getState().isDemo) {
      await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Rappel local « Drop imminent » 10 minutes avant le début.
 * Fonctionne sans serveur ; les notifications serveur prennent le relais en prod.
 */
export async function scheduleDropReminder(drop: Drop): Promise<void> {
  const fireAt = new Date(drop.startsAt).getTime() - 10 * 60_000;
  pushLocalNotification('drop_soon', `${drop.title} — rappel activé`, `On te prévient avant le début du drop.`, { dropId: drop.id });
  if (!isNative || fireAt <= Date.now()) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `drop-${drop.id}`,
    content: { title: `${drop.title} commence bientôt ⏰`, body: drop.subtitle, data: { dropId: drop.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
  });
}

export async function cancelDropReminder(dropId: string): Promise<void> {
  if (!isNative) return;
  await Notifications.cancelScheduledNotificationAsync(`drop-${dropId}`).catch(() => undefined);
}

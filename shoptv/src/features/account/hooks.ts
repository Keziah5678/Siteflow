import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import { getNotificationSettings, listNotifications } from '@/services/notifications';
import { getOrder, listOrders } from '@/services/orders';
import { useDemoAccount } from '@/store/demo-account';
import { useSession } from '@/store/session';

export function useOrders() {
  const userId = useSession((s) => s.userId);
  const demoOrders = useDemoAccount((s) => s.orders);
  return useQuery({ queryKey: [...qk.orders(userId), demoOrders.length], queryFn: listOrders, enabled: !!userId });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: qk.order(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id });
}

export function useNotifications() {
  const userId = useSession((s) => s.userId);
  const demoNotifs = useDemoAccount((s) => s.notifications);
  return useQuery({
    queryKey: [...qk.notifications(userId), demoNotifs.length, demoNotifs.filter((n) => !n.readAt).length],
    queryFn: listNotifications,
    enabled: !!userId,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.readAt).length;
}

export function useNotificationSettings() {
  const userId = useSession((s) => s.userId);
  return useQuery({ queryKey: qk.notificationSettings(userId), queryFn: getNotificationSettings, enabled: !!userId });
}

import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import { getAdminStats, listAdminProducts, listAllOrders, listUsers } from '@/services/admin';

export const useAdminStats = () => useQuery({ queryKey: qk.admin.stats, queryFn: getAdminStats });
export const useAdminProducts = () => useQuery({ queryKey: qk.admin.products, queryFn: listAdminProducts });
export const useAdminOrders = () => useQuery({ queryKey: qk.admin.orders, queryFn: listAllOrders });
export const useAdminUsers = () => useQuery({ queryKey: qk.admin.users, queryFn: listUsers });

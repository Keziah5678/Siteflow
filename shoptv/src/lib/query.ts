import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Clés de cache centralisées. */
export const qk = {
  categories: ['categories'] as const,
  brands: (featured = false) => ['brands', featured] as const,
  products: (params: object) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  productsByIds: (ids: string[]) => ['products-by-ids', ids] as const,
  similar: (id: string) => ['similar', id] as const,
  forYou: (category: string | null) => ['for-you', category] as const,
  feed: (startId: string | null, category: string | null) => ['feed', startId, category] as const,
  drops: ['drops'] as const,
  drop: (id: string) => ['drop', id] as const,
  reviews: (productId: string) => ['reviews', productId] as const,
  comments: (productId: string) => ['comments', productId] as const,
  cart: (lines: unknown) => ['cart', lines] as const,
  orders: (userId: string | null) => ['orders', userId] as const,
  order: (id: string) => ['order', id] as const,
  notifications: (userId: string | null) => ['notifications', userId] as const,
  notificationSettings: (userId: string | null) => ['notification-settings', userId] as const,
  search: (term: string) => ['search', term] as const,
  admin: {
    stats: ['admin', 'stats'] as const,
    products: ['admin', 'products'] as const,
    orders: ['admin', 'orders'] as const,
    users: ['admin', 'users'] as const,
  },
};

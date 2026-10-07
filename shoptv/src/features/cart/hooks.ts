import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import { buildCartSummary } from '@/services/orders';
import { useCart } from '@/store/cart';

/** Panier enrichi (produits, sous-total, livraison, total). */
export function useCartSummary() {
  const lines = useCart((s) => s.lines);
  return useQuery({
    queryKey: qk.cart(lines),
    queryFn: () => buildCartSummary(lines),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

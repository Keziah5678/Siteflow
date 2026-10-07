import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import {
  getProductBySlug,
  getProductsByIds,
  getSimilarProducts,
  listBrands,
  listCategories,
  listProducts,
  PAGE_SIZE,
} from '@/services/catalog';
import { getForYouPage } from '@/services/recommendations';
import type { Product, ProductQuery } from '@/types/models';

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: listCategories, staleTime: 10 * 60_000 });
}

export function useBrands(featuredOnly = false) {
  return useQuery({ queryKey: qk.brands(featuredOnly), queryFn: () => listBrands({ featuredOnly }), staleTime: 10 * 60_000 });
}

export function useProduct(slug: string | undefined) {
  return useQuery({ queryKey: qk.product(slug ?? ''), queryFn: () => getProductBySlug(slug!), enabled: !!slug });
}

export function useProductsByIds(ids: string[]) {
  return useQuery({ queryKey: qk.productsByIds(ids), queryFn: () => getProductsByIds(ids), enabled: ids.length > 0 });
}

export function useSimilarProducts(product: Product | null | undefined) {
  return useQuery({
    queryKey: qk.similar(product?.id ?? ''),
    queryFn: () => getSimilarProducts(product!),
    enabled: !!product,
  });
}

/** Liste paginée (infinite scroll). */
export function useProductsInfinite(params: Omit<ProductQuery, 'offset'>, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: qk.products(params),
    queryFn: ({ pageParam }) => listProducts({ ...params, offset: pageParam, limit: params.limit ?? PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
}

/** Flux « Pour toi » paginé, via le moteur de recommandation. */
export function useForYou(categorySlug: string | null, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: qk.forYou(categorySlug),
    queryFn: ({ pageParam }) => getForYouPage(pageParam, categorySlug),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
}

export const flattenPages = <T,>(data: { pages: { items: T[] }[] } | undefined): T[] =>
  data ? data.pages.flatMap((p) => p.items) : [];

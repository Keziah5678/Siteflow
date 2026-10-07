import { supabase } from '@/lib/supabase';
import type { Brand, Category, Drop, Product } from '@/types/models';

import { listCategories, listProducts, sanitizeSearch } from './catalog';
import { demoDb } from './demo-db';
import { mapBrand, mapDrop } from './mappers';

export interface SearchResults {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  drops: Drop[];
  nextOffset: number | null;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recherche unifiée : produits (paginés), marques, catégories et drops. */
export async function searchAll(rawTerm: string, offset = 0): Promise<SearchResults> {
  const term = sanitizeSearch(rawTerm);
  if (term.length < 2) return { products: [], brands: [], categories: [], drops: [], nextOffset: null };

  const productsPage = listProducts({ search: term, offset, limit: 12, sort: 'popular' });
  if (offset > 0) {
    const page = await productsPage;
    return { products: page.items, brands: [], categories: [], drops: [], nextOffset: page.nextOffset };
  }

  const categories = (await listCategories()).filter((c) => normalize(c.name).includes(normalize(term)));

  if (!supabase) {
    const t = normalize(term);
    const page = await productsPage;
    return {
      products: page.items,
      nextOffset: page.nextOffset,
      categories,
      brands: demoDb.brands.filter((b) => normalize(b.name).includes(t)),
      drops: demoDb.drops.filter((d) => normalize(`${d.title} ${d.subtitle}`).includes(t)),
    };
  }

  const [page, brands, drops] = await Promise.all([
    productsPage,
    supabase.from('brands').select('*').ilike('name', `%${term}%`).limit(8),
    supabase.from('drops').select('*, drop_products(product_id, sort_order)').or(`title.ilike.%${term}%,subtitle.ilike.%${term}%`).limit(6),
  ]);
  return {
    products: page.items,
    nextOffset: page.nextOffset,
    categories,
    brands: (brands.data ?? []).map(mapBrand),
    drops: (drops.data ?? []).map(mapDrop),
  };
}

export const TRENDING_SEARCHES = ['PS5', 'iPhone', 'Sneakers', 'AirPods', 'Voyage', 'Casque'];

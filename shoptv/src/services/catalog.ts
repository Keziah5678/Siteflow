/**
 * Accès catalogue : produits, catégories, marques.
 * Bascule automatiquement entre Supabase et la base démo locale.
 */
import { supabase } from '@/lib/supabase';
import type { Brand, Category, Page, Product, ProductQuery, ProductSort } from '@/types/models';

import { demoDb, hydrateDemoProduct } from './demo-db';
import { mapBrand, mapCategory, mapProduct } from './mappers';

export const PAGE_SIZE = 8;
export const PRODUCT_SELECT = '*, brand:brands(*), category:categories(*), media:product_media(*)';

// ───────────── Catégories & marques (petits référentiels, mis en cache)

let categoriesCache: Category[] | null = null;

export async function listCategories(): Promise<Category[]> {
  if (categoriesCache) return categoriesCache;
  if (!supabase) return [...demoDb.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  categoriesCache = (data ?? []).map(mapCategory);
  return categoriesCache;
}

export function invalidateCategories() {
  categoriesCache = null;
}

/** Catégorie + ses sous-catégories (ex. Tech inclut Smartphones). */
async function categoryIdsFor(slug: string): Promise<string[]> {
  const cats = await listCategories();
  const root = cats.find((c) => c.slug === slug);
  if (!root) return [];
  return [root.id, ...cats.filter((c) => c.parentId === root.id).map((c) => c.id)];
}

export async function listBrands(options: { featuredOnly?: boolean } = {}): Promise<Brand[]> {
  if (!supabase) {
    return demoDb.brands.filter((b) => !options.featuredOnly || b.isFeatured);
  }
  let q = supabase.from('brands').select('*').order('name');
  if (options.featuredOnly) q = q.eq('is_featured', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapBrand);
}

// ───────────── Produits

function sortDemo(items: Product[], sort: ProductSort): Product[] {
  const sorted = [...items];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'price_asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'discount':
      return sorted.sort((a, b) => b.discountPercentage - a.discountPercentage);
    default:
      return sorted.sort((a, b) => b.popularity - a.popularity);
  }
}

/** Abréviations courantes → terme présent dans le catalogue. */
const SEARCH_SYNONYMS: Record<string, string> = {
  ps5: 'playstation 5',
  ps: 'playstation',
  play: 'playstation',
  tele: 'tv',
  télé: 'tv',
  television: 'tv',
  ecouteurs: 'buds',
  écouteurs: 'airpods',
  mac: 'macbook',
  voyage: 'séjour',
  sneaker: 'nike',
};

/** Échappe une saisie utilisateur pour un filtre PostgREST `or(...)` et applique les synonymes. */
export function sanitizeSearch(input: string): string {
  const cleaned = input.replace(/[%*,()\\:."']/g, ' ').trim().slice(0, 60);
  return SEARCH_SYNONYMS[cleaned.toLowerCase()] ?? cleaned;
}

export async function listProducts(query: ProductQuery = {}): Promise<Page<Product>> {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? PAGE_SIZE;
  const sort = query.sort ?? 'popular';
  const categoryIds = query.categorySlug ? await categoryIdsFor(query.categorySlug) : null;
  const term = query.search ? sanitizeSearch(query.search) : '';

  if (!supabase) {
    let items = demoDb.products.filter((p) => p.isActive);
    if (categoryIds) items = items.filter((p) => p.categoryId && categoryIds.includes(p.categoryId));
    if (query.brandSlug) {
      const brand = demoDb.brands.find((b) => b.slug === query.brandSlug);
      items = items.filter((p) => p.brandId === brand?.id);
    }
    if (query.ids) items = items.filter((p) => query.ids!.includes(p.id));
    if (query.excludeId) items = items.filter((p) => p.id !== query.excludeId);
    if (term) {
      const t = term.toLowerCase();
      items = items.filter((p) => {
        const brand = demoDb.brands.find((b) => b.id === p.brandId)?.name ?? '';
        return `${p.name} ${p.tagline} ${brand}`.toLowerCase().includes(t);
      });
    }
    const sorted = sortDemo(items, sort).slice(offset, offset + limit).map(hydrateDemoProduct);
    return { items: sorted, nextOffset: offset + limit < items.length ? offset + limit : null };
  }

  let q = supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true);
  if (categoryIds) q = q.in('category_id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000']);
  if (query.brandSlug) {
    const { data: brand } = await supabase.from('brands').select('id').eq('slug', query.brandSlug).maybeSingle();
    q = q.eq('brand_id', brand?.id ?? '00000000-0000-0000-0000-000000000000');
  }
  if (query.ids) q = q.in('id', query.ids.length ? query.ids : ['00000000-0000-0000-0000-000000000000']);
  if (query.excludeId) q = q.neq('id', query.excludeId);
  if (term) {
    const { data: brandMatches } = await supabase.from('brands').select('id').ilike('name', `%${term}%`).limit(10);
    const brandFilter = (brandMatches ?? []).length ? `,brand_id.in.(${(brandMatches ?? []).map((b) => b.id).join(',')})` : '';
    q = q.or(`name.ilike.%${term}%,tagline.ilike.%${term}%${brandFilter}`);
  }
  switch (sort) {
    case 'newest':
      q = q.order('created_at', { ascending: false });
      break;
    case 'price_asc':
      q = q.order('price', { ascending: true });
      break;
    case 'price_desc':
      q = q.order('price', { ascending: false });
      break;
    case 'discount':
      q = q.order('discount_percentage', { ascending: false });
      break;
    default:
      q = q.order('popularity', { ascending: false });
  }
  q = q.order('id').range(offset, offset + limit - 1);
  const { data, error } = await q;
  if (error) throw error;
  const items = (data ?? []).map(mapProduct);
  return { items, nextOffset: items.length === limit ? offset + limit : null };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!supabase) {
    const p = demoDb.products.find((x) => x.slug === slug || x.id === slug);
    return p ? hydrateDemoProduct(p) : null;
  }
  const isUuid = /^[0-9a-f-]{36}$/i.test(slug);
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq(isUuid ? 'id' : 'slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data) : null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const page = await listProducts({ ids, limit: ids.length });
  // Conserve l'ordre demandé.
  return ids.map((id) => page.items.find((p) => p.id === id)).filter((p): p is Product => !!p);
}

export async function getSimilarProducts(product: Product, limit = 6): Promise<Product[]> {
  const category = product.category ?? (await listCategories()).find((c) => c.id === product.categoryId);
  const page = await listProducts({ categorySlug: category?.slug ?? null, excludeId: product.id, limit });
  if (page.items.length >= 3) return page.items;
  const fallback = await listProducts({ excludeId: product.id, limit });
  return fallback.items;
}

export async function incrementShare(productId: string): Promise<void> {
  if (!supabase) {
    const p = demoDb.products.find((x) => x.id === productId);
    if (p) p.sharesCount += 1;
    return;
  }
  await supabase.rpc('increment_share', { p_product_id: productId });
}

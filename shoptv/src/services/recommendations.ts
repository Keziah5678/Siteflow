/**
 * Recommandation « Pour toi ».
 * Architecture : une interface `RecommendationEngine` interchangeable.
 * - `HeuristicEngine` (par défaut) : affinité catégorie pondérée et
 *   décroissante dans le temps + popularité + remise, calculée localement.
 * - `ServerEngine` : RPC SQL `for_you_products` (utilisateur connecté).
 * Pour brancher un moteur ML plus tard : implémenter l'interface et
 * l'enregistrer dans `getRecommendationEngine()`.
 */
import { supabase } from '@/lib/supabase';
import { useLibrary } from '@/store/library';
import { useSession } from '@/store/session';
import type { Page, Product, UserEvent } from '@/types/models';

import { listProducts, PAGE_SIZE, PRODUCT_SELECT } from './catalog';
import { mapProduct } from './mappers';

export interface RecommendationContext {
  events: UserEvent[];
  likedIds: string[];
  favoriteIds: string[];
  categorySlug?: string | null;
}

export interface RecommendationEngine {
  readonly name: string;
  getForYou(ctx: RecommendationContext, offset: number, limit: number): Promise<Page<Product>>;
}

const EVENT_WEIGHT: Record<UserEvent['type'], number> = {
  purchase: 8,
  favorite: 5,
  like: 3,
  watch: 2,
  view_product: 1.5,
  view_category: 1,
};
const HALF_LIFE_MS = 14 * 24 * 3_600_000;

/** Score d'affinité par catégorie (décroissance exponentielle sur 14 jours). */
export function categoryAffinity(events: UserEvent[], now = Date.now()): Map<string, number> {
  const scores = new Map<string, number>();
  for (const e of events) {
    if (!e.categoryId) continue;
    const weight = e.type === 'watch' ? Math.min((e.value ?? 0) / 10, 4) : EVENT_WEIGHT[e.type];
    const decay = Math.exp(-(now - e.at) / HALF_LIFE_MS);
    scores.set(e.categoryId, (scores.get(e.categoryId) ?? 0) + weight * decay);
  }
  return scores;
}

export function scoreProduct(p: Product, affinity: Map<string, number>, ctx: RecommendationContext): number {
  const cat = p.categoryId ? (affinity.get(p.categoryId) ?? 0) : 0;
  const parent = p.category?.parentId ? (affinity.get(p.category.parentId) ?? 0) * 0.5 : 0;
  const alreadyLoved = ctx.likedIds.includes(p.id) || ctx.favoriteIds.includes(p.id) ? -6 : 0;
  return (cat + parent) * 10 + p.popularity * 0.5 + p.discountPercentage * 0.3 + alreadyLoved;
}

const CANDIDATE_POOL = 60;

class HeuristicEngine implements RecommendationEngine {
  readonly name = 'heuristic-v1';
  private pool: { key: string; at: number; items: Product[]; hasMore: boolean } | null = null;

  /**
   * Pool de candidats borné (jamais tout le catalogue), classé une seule fois
   * puis mis en cache : l'ordre reste stable pendant le défilement.
   * Un rafraîchissement (offset 0) recalcule le classement.
   */
  private async ranked(ctx: RecommendationContext, offset: number) {
    const key = ctx.categorySlug ?? '*';
    const fresh = this.pool && this.pool.key === key && (offset > 0 || Date.now() - this.pool.at < 5_000);
    if (fresh && this.pool) return this.pool;
    const page = await listProducts({ categorySlug: ctx.categorySlug, offset: 0, limit: CANDIDATE_POOL, sort: 'popular' });
    const affinity = categoryAffinity(ctx.events);
    const items = [...page.items].sort((a, b) => scoreProduct(b, affinity, ctx) - scoreProduct(a, affinity, ctx));
    this.pool = { key, at: Date.now(), items, hasMore: page.nextOffset !== null };
    return this.pool;
  }

  async getForYou(ctx: RecommendationContext, offset: number, limit: number): Promise<Page<Product>> {
    if (offset >= CANDIDATE_POOL) {
      // Au-delà du pool : flux par popularité.
      return listProducts({ categorySlug: ctx.categorySlug, offset, limit, sort: 'popular' });
    }
    const pool = await this.ranked(ctx, offset);
    const items = pool.items.slice(offset, offset + limit);
    const end = offset + items.length;
    const nextOffset = end < pool.items.length ? end : pool.hasMore ? CANDIDATE_POOL : null;
    return { items, nextOffset };
  }
}

class ServerEngine implements RecommendationEngine {
  readonly name = 'sql-affinity-v1';

  async getForYou(_ctx: RecommendationContext, offset: number, limit: number): Promise<Page<Product>> {
    const { data, error } = await supabase!.rpc('for_you_products', { p_limit: limit, p_offset: offset }).select(PRODUCT_SELECT);
    if (error) throw error;
    const items = (data ?? []).map(mapProduct);
    return { items, nextOffset: items.length === limit ? offset + limit : null };
  }
}

const heuristic = new HeuristicEngine();
const server = new ServerEngine();

export function getRecommendationEngine(categorySlug?: string | null): RecommendationEngine {
  const { userId, isDemo } = useSession.getState();
  // Le moteur serveur couvre le flux global ; le filtrage catégorie reste local.
  if (supabase && userId && !isDemo && !categorySlug) return server;
  return heuristic;
}

export async function getForYouPage(offset: number, categorySlug?: string | null, limit = PAGE_SIZE): Promise<Page<Product>> {
  const lib = useLibrary.getState();
  const ctx: RecommendationContext = {
    events: lib.events,
    likedIds: lib.likes,
    favoriteIds: lib.favorites.map((f) => f.productId),
    categorySlug,
  };
  return getRecommendationEngine(categorySlug).getForYou(ctx, offset, limit);
}

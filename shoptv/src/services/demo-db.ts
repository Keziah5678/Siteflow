/**
 * Base de données locale du MODE DÉMO (Supabase non configuré).
 * Construite à partir du catalogue de démonstration et modifiable en mémoire
 * (l'admin peut créer/modifier/supprimer pendant la session).
 */
import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_COMMENTS,
  SEED_DROPS,
  SEED_PRODUCTS,
  SEED_REVIEW_TEXTS,
  SEED_REVIEWERS,
  demoId,
} from '@/data/demo-catalog';
import { discountOf } from '@/lib/format';
import type { Brand, Category, Comment, Drop, Product, Review } from '@/types/models';

function startOfToday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function build() {
  const now = Date.now();
  const categories: Category[] = SEED_CATEGORIES.map((c) => ({
    id: demoId('cat', c.n),
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    imageUrl: c.image,
    sortOrder: c.order,
    isPopular: c.popular,
    parentId: c.parent ? demoId('cat', c.parent) : null,
  }));

  const brands: Brand[] = SEED_BRANDS.map((b) => ({
    id: demoId('brand', b.n),
    name: b.name,
    slug: b.slug,
    logoUrl: null,
    monogram: b.monogram,
    isFeatured: b.featured,
  }));

  const products: Product[] = SEED_PRODUCTS.map((p) => {
    const id = demoId('prod', p.n);
    const created = new Date(now - p.n * DAY).toISOString();
    const media = [
      ...(p.video ? [{ id: `${id}-v`, productId: id, type: 'video' as const, url: p.video, posterUrl: p.images[0], sortOrder: 0 }] : []),
      ...p.images.map((url, i) => ({ id: `${id}-i${i}`, productId: id, type: 'image' as const, url, posterUrl: null, sortOrder: i + 1 })),
    ];
    return {
      id,
      name: p.name,
      slug: p.slug,
      tagline: p.tagline,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAt,
      discountPercentage: discountOf(p.price, p.compareAt),
      brandId: p.brand ? demoId('brand', p.brand) : null,
      categoryId: demoId('cat', p.category),
      stock: p.stock,
      rating: p.rating,
      reviewCount: p.reviewCount,
      shippingInfo: p.shipping,
      warranty: p.warranty,
      features: p.features,
      variants: p.variants,
      media,
      coverUrl: p.images[0],
      videoUrl: p.video,
      likesCount: p.likes,
      commentsCount: p.comments,
      sharesCount: p.shares,
      popularity: p.popularity,
      createdAt: created,
      updatedAt: created,
      isActive: true,
    };
  });

  const today = startOfToday();
  const drops: Drop[] = SEED_DROPS.map((d) => {
    const start = today + d.day * DAY + d.hour * HOUR;
    return {
      id: demoId('drop', d.n),
      title: d.title,
      subtitle: d.subtitle,
      description: d.description,
      imageUrl: d.image,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + d.durationHours * HOUR).toISOString(),
      isMega: d.mega,
      productIds: d.products.map((n) => demoId('prod', n)),
      createdAt: new Date(now - 7 * DAY).toISOString(),
    };
  });

  const reviews: Review[] = [];
  const comments: Comment[] = [];
  for (const p of SEED_PRODUCTS) {
    const productId = demoId('prod', p.n);
    for (let i = 0; i < 3; i++) {
      const r = SEED_REVIEW_TEXTS[(p.n + i) % SEED_REVIEW_TEXTS.length];
      reviews.push({
        id: `${productId}-r${i}`,
        productId,
        userId: '',
        authorName: SEED_REVIEWERS[(p.n + i * 3) % SEED_REVIEWERS.length],
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: new Date(now - (i * 3 + 1) * DAY).toISOString(),
      });
      comments.push({
        id: `${productId}-c${i}`,
        productId,
        userId: '',
        authorName: SEED_REVIEWERS[(p.n + i * 5) % SEED_REVIEWERS.length],
        body: SEED_COMMENTS[(p.n + i) % SEED_COMMENTS.length],
        createdAt: new Date(now - (i * 2 + 1) * HOUR).toISOString(),
      });
    }
  }

  return { categories, brands, products, drops, reviews, comments };
}

export const demoDb = build();

/** Joint marque et catégorie, comme le ferait la requête Supabase. */
export function hydrateDemoProduct(p: Product): Product {
  return {
    ...p,
    brand: demoDb.brands.find((b) => b.id === p.brandId) ?? null,
    category: demoDb.categories.find((c) => c.id === p.categoryId) ?? null,
  };
}

/**
 * Génère supabase/seed.sql à partir de src/data/demo-catalog.ts.
 * Usage : npm run seed:generate
 * Les dates des Drops sont relatives à now() pour rester « vivantes ».
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_COMMENTS,
  SEED_DROPS,
  SEED_PRODUCTS,
  SEED_REVIEW_TEXTS,
  SEED_REVIEWERS,
  demoId,
} from '../src/data/demo-catalog.ts';

const q = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const j = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const out: string[] = [
  '-- Généré par scripts/generate-seed.ts — ne pas modifier à la main.',
  '-- Données de démonstration SHOPTV (médias publics pour le prototype).',
  'begin;',
  '',
];

out.push('insert into public.categories (id, name, slug, icon, image_url, parent_id, sort_order, is_popular) values');
out.push(
  SEED_CATEGORIES.map(
    (c) =>
      `  (${q(demoId('cat', c.n))}, ${q(c.name)}, ${q(c.slug)}, ${q(c.icon)}, ${q(c.image)}, ${c.parent ? q(demoId('cat', c.parent)) : 'null'}, ${c.order}, ${c.popular})`,
  ).join(',\n') + '\non conflict (id) do nothing;\n',
);

out.push('insert into public.brands (id, name, slug, monogram, is_featured) values');
out.push(
  SEED_BRANDS.map((b) => `  (${q(demoId('brand', b.n))}, ${q(b.name)}, ${q(b.slug)}, ${q(b.monogram)}, ${b.featured})`).join(',\n') +
    '\non conflict (id) do nothing;\n',
);

out.push(
  'insert into public.products (id, name, slug, tagline, description, price, compare_at_price, brand_id, category_id, stock, rating, review_count, shipping_info, warranty, features, variants, cover_url, video_url, likes_count, comments_count, shares_count, popularity, created_at) values',
);
out.push(
  SEED_PRODUCTS.map(
    (p) =>
      `  (${q(demoId('prod', p.n))}, ${q(p.name)}, ${q(p.slug)}, ${q(p.tagline)}, ${q(p.description)}, ${p.price}, ${p.compareAt ?? 'null'}, ${p.brand ? q(demoId('brand', p.brand)) : 'null'}, ${q(demoId('cat', p.category))}, ${p.stock}, ${p.rating}, ${p.reviewCount}, ${q(p.shipping)}, ${q(p.warranty)}, ${j(p.features)}, ${j(p.variants)}, ${q(p.images[0])}, ${q(p.video)}, ${p.likes}, ${p.comments}, ${p.shares}, ${p.popularity}, now() - interval '${p.n} days')`,
  ).join(',\n') + '\non conflict (id) do nothing;\n',
);

const media: string[] = [];
for (const p of SEED_PRODUCTS) {
  const pid = q(demoId('prod', p.n));
  let order = 0;
  if (p.video) media.push(`  (${pid}, 'video', ${q(p.video)}, ${q(p.images[0])}, ${order++})`);
  for (const url of p.images) media.push(`  (${pid}, 'image', ${q(url)}, null, ${order++})`);
}
out.push('insert into public.product_media (product_id, type, url, poster_url, sort_order) values');
out.push(media.join(',\n') + ';\n');

out.push('insert into public.drops (id, title, subtitle, description, image_url, starts_at, ends_at, is_mega) values');
out.push(
  SEED_DROPS.map((d) => {
    const start = `date_trunc('day', now()) + interval '${d.day} days' + interval '${d.hour} hours'`;
    return `  (${q(demoId('drop', d.n))}, ${q(d.title)}, ${q(d.subtitle)}, ${q(d.description)}, ${q(d.image)}, ${start}, ${start} + interval '${d.durationHours} hours', ${d.mega})`;
  }).join(',\n') + '\non conflict (id) do nothing;\n',
);

out.push('insert into public.drop_products (drop_id, product_id, sort_order) values');
out.push(
  SEED_DROPS.flatMap((d) => d.products.map((p, i) => `  (${q(demoId('drop', d.n))}, ${q(demoId('prod', p))}, ${i})`)).join(',\n') +
    '\non conflict do nothing;\n',
);

// Avis et commentaires de démonstration (sans utilisateur rattaché).
const reviews: string[] = [];
const comments: string[] = [];
for (const p of SEED_PRODUCTS) {
  const pid = q(demoId('prod', p.n));
  for (let i = 0; i < 3; i++) {
    const r = SEED_REVIEW_TEXTS[(p.n + i) % SEED_REVIEW_TEXTS.length];
    const author = SEED_REVIEWERS[(p.n + i * 3) % SEED_REVIEWERS.length];
    reviews.push(`  (${pid}, ${q(author)}, ${r.rating}, ${q(r.title)}, ${q(r.body)}, now() - interval '${i * 3 + 1} days')`);
  }
  for (let i = 0; i < 3; i++) {
    const body = SEED_COMMENTS[(p.n + i) % SEED_COMMENTS.length];
    const author = SEED_REVIEWERS[(p.n + i * 5) % SEED_REVIEWERS.length];
    comments.push(`  (${pid}, ${q(author)}, ${q(body)}, now() - interval '${i * 2 + 1} hours')`);
  }
}
// Les triggers recalculent note et compteurs : on les neutralise pour garder les valeurs de démo.
out.push('alter table public.reviews disable trigger reviews_apply;');
out.push('alter table public.comments disable trigger comments_counter;');
out.push('insert into public.reviews (product_id, author_name, rating, title, body, created_at) values');
out.push(reviews.join(',\n') + ';');
out.push('insert into public.comments (product_id, author_name, body, created_at) values');
out.push(comments.join(',\n') + ';');
out.push('alter table public.reviews enable trigger reviews_apply;');
out.push('alter table public.comments enable trigger comments_counter;');
out.push('', 'commit;', '');

const target = join(import.meta.dirname, '..', 'supabase', 'seed.sql');
writeFileSync(target, out.join('\n'));
console.log(`✔ seed.sql généré (${SEED_PRODUCTS.length} produits, ${SEED_DROPS.length} drops) → ${target}`);

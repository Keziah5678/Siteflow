/**
 * Catalogue de démonstration — SOURCE UNIQUE.
 * - Utilisé par le mode démo (aucune variable Supabase) via `services/demo-db.ts`.
 * - Utilisé par `scripts/generate-seed.mjs` pour produire `supabase/seed.sql`.
 * Les médias pointent vers des URLs publiques (prototype). En production,
 * remplacez-les par des chemins Supabase Storage (`product-images/…`).
 * Les composants ne doivent JAMAIS importer ce fichier directement.
 */

const img = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const video = (name: string) => `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;

export const demoId = (kind: 'cat' | 'brand' | 'prod' | 'drop' | 'user', n: number) => {
  const prefix = { cat: 'c', brand: 'b', prod: 'a', drop: 'd', user: 'e' }[kind];
  return `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
};

export interface SeedCategory {
  n: number;
  name: string;
  slug: string;
  icon: string;
  image: string;
  parent?: number;
  popular: boolean;
  order: number;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { n: 1, name: 'Gaming', slug: 'gaming', icon: 'game-controller-outline', image: img('1606318801954-d46d46d3360a', 500), popular: true, order: 1 },
  { n: 2, name: 'Tech', slug: 'tech', icon: 'phone-portrait-outline', image: img('1496181133206-80ce9b88a853', 500), popular: false, order: 2 },
  { n: 3, name: 'Mode', slug: 'mode', icon: 'shirt-outline', image: img('1556821840-3a63f95609a7', 500), popular: false, order: 3 },
  { n: 4, name: 'Maison', slug: 'maison', icon: 'home-outline', image: img('1555041469-a586c61ea9bc', 500), popular: true, order: 4 },
  { n: 5, name: 'Beauté', slug: 'beaute', icon: 'sparkles-outline', image: img('1541643600914-78b084683601', 500), popular: true, order: 5 },
  { n: 6, name: 'Voyages', slug: 'voyages', icon: 'airplane-outline', image: img('1507525428034-b723cf961d3e', 500), popular: true, order: 6 },
  { n: 7, name: 'Smartphones', slug: 'smartphones', icon: 'phone-portrait-outline', image: img('1511707171634-5f897ff02aa9', 500), parent: 2, popular: true, order: 7 },
  { n: 8, name: 'Sneakers', slug: 'sneakers', icon: 'footsteps-outline', image: img('1549298916-b41d501d3772', 500), parent: 3, popular: true, order: 8 },
];

export interface SeedBrand {
  n: number;
  name: string;
  slug: string;
  monogram: string;
  featured: boolean;
}

/** Les marques sont affichées sous forme de monogrammes : aucun logo officiel n'est reproduit. */
export const SEED_BRANDS: SeedBrand[] = [
  { n: 1, name: 'PlayStation', slug: 'playstation', monogram: 'PS', featured: true },
  { n: 2, name: 'Nike', slug: 'nike', monogram: 'NK', featured: true },
  { n: 3, name: 'Apple', slug: 'apple', monogram: 'A', featured: true },
  { n: 4, name: 'Samsung', slug: 'samsung', monogram: 'S', featured: true },
  { n: 5, name: 'Adidas', slug: 'adidas', monogram: 'AD', featured: true },
  { n: 6, name: 'Nova Audio', slug: 'nova-audio', monogram: 'NA', featured: false },
  { n: 7, name: 'Maison Lune', slug: 'maison-lune', monogram: 'ML', featured: false },
  { n: 8, name: 'Atelier Violette', slug: 'atelier-violette', monogram: 'AV', featured: false },
  { n: 9, name: 'Horizon Voyages', slug: 'horizon-voyages', monogram: 'HV', featured: false },
];

export interface SeedProduct {
  n: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  compareAt: number | null;
  brand: number | null;
  category: number;
  stock: number;
  rating: number;
  reviewCount: number;
  shipping: string;
  warranty: string;
  features: string[];
  variants: { id: string; label: string; value: string; colorHex?: string }[];
  images: string[];
  video: string | null;
  likes: number;
  comments: number;
  shares: number;
  popularity: number;
}

const CLIPS = ['ForBiggerBlazes', 'ForBiggerEscapes', 'ForBiggerFun', 'ForBiggerJoyrides', 'ForBiggerMeltdowns'];
const clip = (i: number) => video(CLIPS[i % CLIPS.length]);

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    n: 1,
    name: 'PlayStation 5 Slim',
    slug: 'playstation-5-slim',
    tagline: 'La nouvelle génération de jeu.',
    description:
      'Plonge dans une nouvelle dimension de jeu avec la PS5 Slim. Plus compacte, plus puissante, une expérience encore plus immersive. SSD ultra-rapide, retour haptique et audio 3D.',
    price: 449,
    compareAt: 599,
    brand: 1,
    category: 1,
    stock: 18,
    rating: 4.8,
    reviewCount: 12341,
    shipping: 'Livraison 2-4 jours',
    warranty: 'Garantie 2 ans',
    features: ['SSD 1 To ultra-rapide', 'Jeux jusqu’à 120 fps', 'Ray tracing', 'Manette DualSense incluse', 'Audio 3D Tempest'],
    variants: [
      { id: 'white', label: 'Couleur', value: 'Blanc', colorHex: '#F4F4F8' },
      { id: 'black', label: 'Couleur', value: 'Noir', colorHex: '#111118' },
    ],
    images: [img('1606813907291-d86efa9b94db'), img('1607853202273-797f1c22a38e'), img('1606318801954-d46d46d3360a'), img('1622297845775-5ff3fef71d13')],
    video: clip(0),
    likes: 12400,
    comments: 342,
    shares: 1100,
    popularity: 98,
  },
  {
    n: 2,
    name: 'Manette DualSense Midnight',
    slug: 'manette-dualsense-midnight',
    tagline: 'Ressens chaque impact.',
    description: 'Gâchettes adaptatives, retour haptique et micro intégré. La manette qui rend chaque partie plus vivante.',
    price: 59,
    compareAt: 74.99,
    brand: 1,
    category: 1,
    stock: 64,
    rating: 4.7,
    reviewCount: 4210,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Gâchettes adaptatives', 'Retour haptique', 'Micro intégré', 'Batterie rechargeable USB-C'],
    variants: [
      { id: 'midnight', label: 'Couleur', value: 'Midnight', colorHex: '#15131F' },
      { id: 'white', label: 'Couleur', value: 'Blanc', colorHex: '#F4F4F8' },
    ],
    images: [img('1606318801954-d46d46d3360a'), img('1592840496694-26d035b52b48')],
    video: clip(1),
    likes: 5300,
    comments: 128,
    shares: 410,
    popularity: 80,
  },
  {
    n: 3,
    name: 'Casque Gaming Pulse X',
    slug: 'casque-gaming-pulse-x',
    tagline: 'Entends l’ennemi avant qu’il te voie.',
    description: 'Audio spatial 7.1, micro antibruit détachable et coussinets à mémoire de forme pour des sessions sans fin.',
    price: 89,
    compareAt: 129,
    brand: 6,
    category: 1,
    stock: 40,
    rating: 4.6,
    reviewCount: 1890,
    shipping: 'Livraison 2-3 jours',
    warranty: 'Garantie 2 ans',
    features: ['Audio spatial 7.1', 'Micro antibruit', 'Sans fil 2,4 GHz', '30 h d’autonomie', 'Éclairage RGB'],
    variants: [{ id: 'black', label: 'Couleur', value: 'Noir', colorHex: '#111118' }],
    images: [img('1618366712010-f4ae9c647dcb'), img('1599669454699-248893623440')],
    video: clip(2),
    likes: 3100,
    comments: 87,
    shares: 230,
    popularity: 70,
  },
  {
    n: 4,
    name: 'iPhone 16 Pro',
    slug: 'iphone-16-pro',
    tagline: 'Titane. Puissance. Caméra pro.',
    description: 'Un design en titane, une puce surpuissante et un système photo pro pour capturer chaque détail, même de nuit.',
    price: 1129,
    compareAt: 1329,
    brand: 3,
    category: 7,
    stock: 22,
    rating: 4.8,
    reviewCount: 8920,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Écran 6,3" 120 Hz', 'Triple caméra 48 Mpx', 'Châssis titane', 'USB-C', 'Bouton Action'],
    variants: [
      { id: 'black', label: 'Couleur', value: 'Titane noir', colorHex: '#2B2B30' },
      { id: 'natural', label: 'Couleur', value: 'Titane naturel', colorHex: '#BFB8AE' },
      { id: 'white', label: 'Couleur', value: 'Titane blanc', colorHex: '#E9E8E4' },
    ],
    images: [img('1592750475338-74b7b21085ab'), img('1511707171634-5f897ff02aa9')],
    video: clip(3),
    likes: 9800,
    comments: 410,
    shares: 920,
    popularity: 95,
  },
  {
    n: 5,
    name: 'AirPods Pro 2',
    slug: 'airpods-pro-2',
    tagline: 'Le silence, version premium.',
    description: 'Réduction active du bruit jusqu’à deux fois plus efficace, audio adaptatif et boîtier MagSafe USB-C.',
    price: 229,
    compareAt: 279,
    brand: 3,
    category: 2,
    stock: 55,
    rating: 4.7,
    reviewCount: 15200,
    shipping: 'Livraison 24h',
    warranty: 'Garantie 2 ans',
    features: ['Réduction active du bruit', 'Audio spatial personnalisé', 'Boîtier MagSafe USB-C', '6 h d’écoute'],
    variants: [],
    images: [img('1600294037681-c80b4cb5b434'), img('1606220588913-b3aacb4d2f46')],
    video: clip(4),
    likes: 7600,
    comments: 205,
    shares: 640,
    popularity: 88,
  },
  {
    n: 6,
    name: 'Galaxy S25 Ultra',
    slug: 'galaxy-s25-ultra',
    tagline: 'Le zoom qui change tout.',
    description: 'Zoom 100x, stylet intégré et un écran lumineux comme jamais. Le smartphone pensé pour créer.',
    price: 1099,
    compareAt: 1469,
    brand: 4,
    category: 7,
    stock: 15,
    rating: 4.6,
    reviewCount: 5120,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Capteur 200 Mpx', 'Zoom 100x', 'S Pen intégré', 'Écran 6,8" QHD+', '5000 mAh'],
    variants: [
      { id: 'violet', label: 'Couleur', value: 'Violet', colorHex: '#5B3F8C' },
      { id: 'black', label: 'Couleur', value: 'Noir', colorHex: '#1A1A1F' },
    ],
    images: [img('1610945265064-0e34e5519bbf'), img('1511707171634-5f897ff02aa9')],
    video: clip(0),
    likes: 6100,
    comments: 198,
    shares: 512,
    popularity: 84,
  },
  {
    n: 7,
    name: 'Apple Watch Series 10',
    slug: 'apple-watch-series-10',
    tagline: 'Ta santé, au poignet.',
    description: 'Plus fine, plus grande, plus intelligente. Suivi du sommeil, ECG et détection des accidents.',
    price: 399,
    compareAt: 449,
    brand: 3,
    category: 2,
    stock: 30,
    rating: 4.7,
    reviewCount: 3980,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Écran Retina toujours activé', 'ECG', 'Suivi du sommeil', 'Étanche 50 m'],
    variants: [
      { id: '42', label: 'Taille', value: '42 mm' },
      { id: '46', label: 'Taille', value: '46 mm' },
    ],
    images: [img('1546868871-7041f2a55e12'), img('1434493789847-2f02dc6ca35d')],
    video: clip(1),
    likes: 4200,
    comments: 96,
    shares: 300,
    popularity: 76,
  },
  {
    n: 8,
    name: 'TV Neo QLED 65"',
    slug: 'tv-neo-qled-65',
    tagline: 'Le cinéma s’invite au salon.',
    description: 'Mini LED, 4K 120 Hz et un son Dolby Atmos pour une immersion totale, du film au jeu vidéo.',
    price: 1199,
    compareAt: 1799,
    brand: 4,
    category: 2,
    stock: 8,
    rating: 4.5,
    reviewCount: 2140,
    shipping: 'Livraison & installation 3-5 jours',
    warranty: 'Garantie 3 ans',
    features: ['Dalle Mini LED 4K', '120 Hz — mode jeu', 'Dolby Atmos', 'Smart TV'],
    variants: [
      { id: '55', label: 'Taille', value: '55"' },
      { id: '65', label: 'Taille', value: '65"' },
    ],
    images: [img('1593359677879-a4bb92f829d1'), img('1593784991095-a205069470b6')],
    video: clip(2),
    likes: 2900,
    comments: 64,
    shares: 180,
    popularity: 66,
  },
  {
    n: 9,
    name: 'MacBook Air M4',
    slug: 'macbook-air-m4',
    tagline: 'Fin. Silencieux. Redoutable.',
    description: 'Une autonomie de toute une journée, une puce M4 ultra-efficace et un écran Liquid Retina éclatant.',
    price: 1099,
    compareAt: 1299,
    brand: 3,
    category: 2,
    stock: 12,
    rating: 4.9,
    reviewCount: 6340,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Puce M4', '16 Go de mémoire', 'SSD 512 Go', '18 h d’autonomie', 'Écran 13,6"'],
    variants: [
      { id: 'midnight', label: 'Couleur', value: 'Minuit', colorHex: '#1E2430' },
      { id: 'silver', label: 'Couleur', value: 'Argent', colorHex: '#D9DADC' },
    ],
    images: [img('1517336714731-489689fd1ca8'), img('1496181133206-80ce9b88a853')],
    video: clip(3),
    likes: 5700,
    comments: 150,
    shares: 420,
    popularity: 82,
  },
  {
    n: 10,
    name: 'Nike Air Max Pulse',
    slug: 'nike-air-max-pulse',
    tagline: 'L’amorti qui fait la différence.',
    description: 'Une silhouette urbaine, un amorti Air visible et un confort pensé pour bouger toute la journée.',
    price: 139,
    compareAt: 179,
    brand: 2,
    category: 8,
    stock: 46,
    rating: 4.6,
    reviewCount: 2870,
    shipping: 'Livraison 2-4 jours',
    warranty: 'Retours 30 jours',
    features: ['Amorti Air visible', 'Tige en mesh respirant', 'Semelle caoutchouc'],
    variants: [
      { id: '40', label: 'Pointure', value: '40' },
      { id: '41', label: 'Pointure', value: '41' },
      { id: '42', label: 'Pointure', value: '42' },
      { id: '43', label: 'Pointure', value: '43' },
      { id: '44', label: 'Pointure', value: '44' },
    ],
    images: [img('1542291026-7eec264c27ff'), img('1549298916-b41d501d3772'), img('1600185365483-26d7a4cc7519')],
    video: clip(4),
    likes: 8800,
    comments: 260,
    shares: 760,
    popularity: 90,
  },
  {
    n: 11,
    name: 'Adidas Ultraboost Light',
    slug: 'adidas-ultraboost-light',
    tagline: 'Chaque foulée te renvoie l’énergie.',
    description: 'La mousse la plus légère de la gamme pour un retour d’énergie maximal, du footing au quotidien.',
    price: 129,
    compareAt: 180,
    brand: 5,
    category: 8,
    stock: 38,
    rating: 4.5,
    reviewCount: 1960,
    shipping: 'Livraison 2-4 jours',
    warranty: 'Retours 30 jours',
    features: ['Mousse Light Boost', 'Tige Primeknit', 'Semelle Continental'],
    variants: [
      { id: '41', label: 'Pointure', value: '41' },
      { id: '42', label: 'Pointure', value: '42' },
      { id: '43', label: 'Pointure', value: '43' },
    ],
    images: [img('1608231387042-66d1773070a5'), img('1595950653106-6c9ebd614d3a')],
    video: clip(0),
    likes: 3900,
    comments: 101,
    shares: 270,
    popularity: 72,
  },
  {
    n: 12,
    name: 'Hoodie Essentials Oversize',
    slug: 'hoodie-essentials-oversize',
    tagline: 'Le confort, en mode statement.',
    description: 'Coton brossé ultra-doux, coupe oversize et finitions premium. Le basique qui ne l’est pas.',
    price: 59,
    compareAt: 85,
    brand: 5,
    category: 3,
    stock: 70,
    rating: 4.4,
    reviewCount: 980,
    shipping: 'Livraison 2-4 jours',
    warranty: 'Retours 30 jours',
    features: ['80 % coton bio', 'Coupe oversize', 'Poche kangourou'],
    variants: [
      { id: 's', label: 'Taille', value: 'S' },
      { id: 'm', label: 'Taille', value: 'M' },
      { id: 'l', label: 'Taille', value: 'L' },
      { id: 'xl', label: 'Taille', value: 'XL' },
    ],
    images: [img('1556821840-3a63f95609a7'), img('1620799140408-edc6dcb6d633')],
    video: clip(1),
    likes: 2100,
    comments: 54,
    shares: 120,
    popularity: 58,
  },
  {
    n: 13,
    name: 'Canapé Velours Orbit',
    slug: 'canape-velours-orbit',
    tagline: 'Ton salon passe en première classe.',
    description: 'Velours profond, assise moelleuse et lignes arrondies. Un canapé trois places qui sublime ton intérieur.',
    price: 899,
    compareAt: 1290,
    brand: 7,
    category: 4,
    stock: 6,
    rating: 4.6,
    reviewCount: 412,
    shipping: 'Livraison 7-10 jours',
    warranty: 'Garantie 5 ans',
    features: ['3 places', 'Velours anti-taches', 'Pieds en chêne massif', 'Déhoussable'],
    variants: [
      { id: 'violet', label: 'Couleur', value: 'Améthyste', colorHex: '#5A3A86' },
      { id: 'grey', label: 'Couleur', value: 'Anthracite', colorHex: '#3A3A42' },
    ],
    images: [img('1555041469-a586c61ea9bc'), img('1493663284031-b7e3aefcae8e')],
    video: clip(2),
    likes: 1500,
    comments: 39,
    shares: 95,
    popularity: 50,
  },
  {
    n: 14,
    name: 'Parfum Nuit Violette',
    slug: 'parfum-nuit-violette',
    tagline: 'Une signature qui ne s’oublie pas.',
    description: 'Un sillage boisé et floral, mêlant violette, ambre et vanille noire. Eau de parfum 100 ml.',
    price: 79,
    compareAt: 110,
    brand: 8,
    category: 5,
    stock: 50,
    rating: 4.7,
    reviewCount: 1320,
    shipping: 'Livraison 24-48h',
    warranty: 'Satisfait ou remboursé',
    features: ['Eau de parfum 100 ml', 'Notes : violette, ambre, vanille', 'Tenue 10 h'],
    variants: [
      { id: '50', label: 'Format', value: '50 ml' },
      { id: '100', label: 'Format', value: '100 ml' },
    ],
    images: [img('1541643600914-78b084683601'), img('1592945403244-b3fbafd7f539')],
    video: clip(3),
    likes: 2600,
    comments: 70,
    shares: 160,
    popularity: 62,
  },
  {
    n: 15,
    name: 'Séjour Bali — 7 nuits',
    slug: 'sejour-bali-7-nuits',
    tagline: 'Rizières, plages et couchers de soleil.',
    description: 'Vols inclus, villa avec piscine privée et excursions guidées. L’évasion totale, organisée de A à Z.',
    price: 1290,
    compareAt: 1690,
    brand: 9,
    category: 6,
    stock: 20,
    rating: 4.8,
    reviewCount: 640,
    shipping: 'E-billet immédiat',
    warranty: 'Annulation flexible',
    features: ['Vols A/R inclus', 'Villa avec piscine', 'Petits-déjeuners', '3 excursions'],
    variants: [
      { id: 'jun', label: 'Départ', value: 'Juin' },
      { id: 'sep', label: 'Départ', value: 'Septembre' },
    ],
    images: [img('1537996194471-e657df975ab4'), img('1507525428034-b723cf961d3e')],
    video: clip(4),
    likes: 4400,
    comments: 132,
    shares: 610,
    popularity: 74,
  },
  {
    n: 16,
    name: 'Casque Studio Wireless',
    slug: 'casque-studio-wireless',
    tagline: 'Ta musique, sans compromis.',
    description: 'Réduction de bruit adaptative, 40 h d’autonomie et un son haute résolution signé Nova Audio.',
    price: 249,
    compareAt: 349,
    brand: 6,
    category: 2,
    stock: 25,
    rating: 4.6,
    reviewCount: 2310,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Réduction de bruit adaptative', '40 h d’autonomie', 'Hi-Res Audio', 'Charge rapide'],
    variants: [
      { id: 'black', label: 'Couleur', value: 'Noir', colorHex: '#111118' },
      { id: 'white', label: 'Couleur', value: 'Blanc', colorHex: '#F4F4F8' },
    ],
    images: [img('1505740420928-5e560c06d30e'), img('1583394838336-acd977736f90')],
    video: clip(0),
    likes: 3300,
    comments: 88,
    shares: 210,
    popularity: 68,
  },
  {
    n: 17,
    name: 'Galaxy Buds 3 Pro',
    slug: 'galaxy-buds-3-pro',
    tagline: 'Petits écouteurs, grand son.',
    description: 'Son Hi-Fi 24 bits, réduction de bruit intelligente et design ergonomique pour toute la journée.',
    price: 149,
    compareAt: 229,
    brand: 4,
    category: 2,
    stock: 44,
    rating: 4.4,
    reviewCount: 1420,
    shipping: 'Livraison 24-48h',
    warranty: 'Garantie 2 ans',
    features: ['Hi-Fi 24 bits', 'ANC intelligente', 'IP57', '30 h avec boîtier'],
    variants: [],
    images: [img('1590658268037-6bf12165a8df'), img('1606220588913-b3aacb4d2f46')],
    video: clip(1),
    likes: 1800,
    comments: 47,
    shares: 110,
    popularity: 55,
  },
  {
    n: 18,
    name: 'Escapade Maldives — 5 nuits',
    slug: 'escapade-maldives-5-nuits',
    tagline: 'Le bleu, à perte de vue.',
    description: 'Bungalow sur pilotis, pension complète et transfert en hydravion. Le luxe à l’état pur.',
    price: 2490,
    compareAt: 3200,
    brand: 9,
    category: 6,
    stock: 10,
    rating: 4.9,
    reviewCount: 318,
    shipping: 'E-billet immédiat',
    warranty: 'Annulation flexible',
    features: ['Bungalow sur pilotis', 'Pension complète', 'Transfert hydravion', 'Spa inclus'],
    variants: [],
    images: [img('1514282401047-d79a71a590e8'), img('1573843981267-be1999ff37cd')],
    video: clip(2),
    likes: 5200,
    comments: 140,
    shares: 820,
    popularity: 78,
  },
];

/** Planification relative : début = minuit local + `day` jours + `hour` heures. */
export interface SeedDrop {
  n: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  day: number;
  hour: number;
  durationHours: number;
  mega: boolean;
  products: number[];
}

export const SEED_DROPS: SeedDrop[] = [
  {
    n: 1,
    title: 'MEGA DROP',
    subtitle: '10 produits d’exception à prix réduit',
    description: 'Le rendez-vous de la soirée : consoles, smartphones, audio et sneakers à prix cassés, pendant quatre heures seulement.',
    image: img('1606813907291-d86efa9b94db', 1200),
    day: 0,
    hour: 20,
    durationHours: 4,
    mega: true,
    products: [1, 4, 5, 10, 6, 9, 16, 7, 2, 11],
  },
  {
    n: 2,
    title: 'DROP TECH',
    subtitle: 'Le meilleur de la tech',
    description: 'Smartphones, ordinateurs et objets connectés sélectionnés par l’équipe SHOPTV.',
    image: img('1592750475338-74b7b21085ab', 900),
    day: 0,
    hour: 21,
    durationHours: 3,
    mega: false,
    products: [4, 6, 9, 7, 17],
  },
  {
    n: 3,
    title: 'DROP MODE',
    subtitle: 'Sneakers & streetwear',
    description: 'Les paires et pièces les plus demandées de la saison, en quantités limitées.',
    image: img('1549298916-b41d501d3772', 900),
    day: 1,
    hour: 18,
    durationHours: 6,
    mega: false,
    products: [10, 11, 12],
  },
  {
    n: 4,
    title: 'DROP ÉVASION',
    subtitle: 'Voyages d’exception',
    description: 'Des séjours de rêve à prix réduit, à réserver avant qu’ils ne s’envolent.',
    image: img('1507525428034-b723cf961d3e', 900),
    day: 3,
    hour: 10,
    durationHours: 24,
    mega: false,
    products: [15, 18],
  },
  {
    n: 5,
    title: 'FLASH GAMING',
    subtitle: 'Accessoires gaming',
    description: 'Manettes, casques et accessoires : le setup ultime à prix flash.',
    image: img('1606318801954-d46d46d3360a', 900),
    day: 0,
    hour: -2,
    durationHours: 30,
    mega: false,
    products: [2, 3, 1],
  },
  {
    n: 6,
    title: 'DROP MAISON',
    subtitle: 'Intérieur & bien-être',
    description: 'Mobilier et beauté pour un intérieur premium.',
    image: img('1555041469-a586c61ea9bc', 900),
    day: -3,
    hour: 18,
    durationHours: 6,
    mega: false,
    products: [13, 14],
  },
];

export const SEED_REVIEWERS = ['Camille R.', 'Yanis B.', 'Léa M.', 'Hugo D.', 'Inès K.', 'Mathis P.', 'Sarah L.', 'Noah T.'];

export const SEED_REVIEW_TEXTS: { rating: number; title: string; body: string }[] = [
  { rating: 5, title: 'Exactement comme dans la vidéo', body: 'Livraison rapide, produit impeccable. La vidéo m’a convaincu et je ne suis pas déçu.' },
  { rating: 5, title: 'Top qualité', body: 'Finitions premium et prix imbattable pendant le drop. Je recommande.' },
  { rating: 4, title: 'Très bon produit', body: 'Conforme à la description. Petit bémol sur l’emballage, mais rien de grave.' },
  { rating: 5, title: 'Coup de cœur', body: 'Je l’utilise tous les jours. Le rapport qualité-prix est excellent.' },
  { rating: 4, title: 'Satisfait', body: 'Bon produit, service client réactif. J’achèterai à nouveau sur SHOPTV.' },
];

export const SEED_COMMENTS = [
  'Il me le faut 😍',
  'Quelqu’un l’a déjà reçu ? Ça vaut le coup ?',
  'Prix de fou pendant le drop 🔥',
  'Commandé hier, livré ce matin !',
  'La vidéo donne trop envie',
  'Dispo en d’autres coloris ?',
];

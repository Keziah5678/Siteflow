using System;
using UnityEngine;

namespace Appartement
{
    /// <summary>Texture couleur + carte de normales optionnelle, et sa taille réelle en mètres.</summary>
    public class TexSet
    {
        public Texture2D Albedo;
        public Texture2D Normal;
        public float NormalStrength = 1f;
        public Vector2 Meters = Vector2.one;
    }

    /// <summary>Bruit de valeur périodique (textures sans couture).</summary>
    public class PeriodicNoise
    {
        readonly int[] p = new int[512];

        public PeriodicNoise(int seed)
        {
            var r = new System.Random(seed);
            var a = new int[256];
            for (int i = 0; i < 256; i++) a[i] = i;
            for (int i = 255; i > 0; i--) { int j = r.Next(i + 1); int t = a[i]; a[i] = a[j]; a[j] = t; }
            for (int i = 0; i < 512; i++) p[i] = a[i & 255];
        }

        float H(int ix, int iy) { return p[p[ix & 255] + (iy & 255)] / 255f; }

        public float Noise(float x, float y, int px, int py)
        {
            int x0 = Mathf.FloorToInt(x), y0 = Mathf.FloorToInt(y);
            float fx = x - x0, fy = y - y0;
            float ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
            int ix0 = ((x0 % px) + px) % px, iy0 = ((y0 % py) + py) % py;
            int ix1 = (ix0 + 1) % px, iy1 = (iy0 + 1) % py;
            float a = H(ix0, iy0), b = H(ix1, iy0), c = H(ix0, iy1), d = H(ix1, iy1);
            return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
        }

        /// <summary>fBm sur des coordonnées normalisées u, v ∈ [0,1).</summary>
        public float Fbm(float u, float v, int fx, int fy, int oct = 4)
        {
            float sum = 0, amp = 0.5f, norm = 0; int f = 1;
            for (int i = 0; i < oct; i++)
            {
                sum += amp * Noise(u * fx * f, v * fy * f, fx * f, fy * f);
                norm += amp; amp *= 0.5f; f *= 2;
            }
            return sum / norm;
        }
    }

    /// <summary>
    /// Textures procédurales générées au lancement (aucun fichier image) :
    /// parquet, marbres, peinture, plâtre, bouclé, feutrine, lin, chêne, lattes, gazon, lierre, rotin, toile, feuilles, écran TV.
    /// </summary>
    public static class ProceduralTextures
    {
        public struct Px { public Color C; public float H; }

        static Texture2D NewTex(int w, int h, bool linear)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true, linear);
            t.wrapMode = TextureWrapMode.Repeat;
            t.filterMode = FilterMode.Trilinear;
            t.anisoLevel = 8;
            return t;
        }

        /// <summary>Peint une texture pixel par pixel ; le canal H sert de hauteur pour la normale.</summary>
        public static TexSet Paint(int size, Func<float, float, int, int, Px> fn, float meters, bool normal, float strength = 1f)
        {
            var cols = new Color32[size * size];
            var hts = normal ? new float[size * size] : null;
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    var px = fn((float)x / size, (float)y / size, x, y);
                    cols[y * size + x] = px.C;
                    if (hts != null) hts[y * size + x] = px.H;
                }
            var set = new TexSet { Meters = new Vector2(meters, meters), NormalStrength = strength };
            set.Albedo = NewTex(size, size, false);
            set.Albedo.SetPixels32(cols);
            set.Albedo.Apply(true);
            if (hts != null) set.Normal = HeightToNormal(hts, size, size, 2f);
            return set;
        }

        /// <summary>Convertit une carte de hauteurs (périodique) en carte de normales.</summary>
        public static Texture2D HeightToNormal(float[] h, int w, int hh, float k)
        {
            var cols = new Color32[w * hh];
            for (int y = 0; y < hh; y++)
                for (int x = 0; x < w; x++)
                {
                    float l = h[y * w + (x - 1 + w) % w], r = h[y * w + (x + 1) % w];
                    float d = h[((y - 1 + hh) % hh) * w + x], u = h[((y + 1) % hh) * w + x];
                    var n = new Vector3((l - r) * k, (d - u) * k, 1f).normalized;
                    cols[y * w + x] = new Color(n.x * 0.5f + 0.5f, n.y * 0.5f + 0.5f, n.z * 0.5f + 0.5f, 1f);
                }
            var t = NewTex(w, hh, true);
            t.SetPixels32(cols);
            t.Apply(true);
            return t;
        }

        static Color Rgb(float r, float g, float b) { return new Color(Mathf.Clamp01(r / 255f), Mathf.Clamp01(g / 255f), Mathf.Clamp01(b / 255f), 1f); }
        static Color Shade(Color c, float k) { return new Color(Mathf.Clamp01(c.r * k), Mathf.Clamp01(c.g * k), Mathf.Clamp01(c.b * k), 1f); }
        static Px P(Color c, float h = 0.5f) { return new Px { C = c, H = h }; }

        /* ------------------------------ Bois ------------------------------ */

        /// <summary>Parquet stratifié chêne clair, lames de 20 × 120 cm (texture = 2,4 m).</summary>
        public static TexSet WoodFloor(int size = 1024)
        {
            var n = new PeriodicNoise(11);
            var r = new System.Random(5);
            const int cols = 12, per = 2;
            var off = new float[cols];
            for (int i = 0; i < cols; i++) off[i] = (float)r.NextDouble();
            var tint = new float[cols * per];
            for (int i = 0; i < tint.Length; i++) tint[i] = (float)r.NextDouble();
            Color light = Rgb(212, 178, 138), dark = Rgb(176, 136, 96);
            return Paint(size, (u, v, x, y) =>
            {
                float cu = u * cols; int col = Mathf.FloorToInt(cu); float fu = cu - col;
                float vv = (v + off[col]) % 1f; float pv = vv * per;
                int idx = col * per + Mathf.FloorToInt(pv); float fv = pv - Mathf.Floor(pv);
                var c = Color.Lerp(dark, light, 0.45f + tint[idx] * 0.4f);
                float grain = n.Fbm(u + idx * 0.37f, v, 96, 6, 4);
                float fine = n.Noise(u * 512 + idx * 3.1f, v * 8, 512, 8);
                float knot = n.Fbm(u, v + idx * 0.21f, 24, 3, 3);
                c = Shade(c, 0.86f + grain * 0.26f + (fine - 0.5f) * 0.08f - Mathf.Max(0, knot - 0.68f) * 0.6f);
                float h = 0.6f + (grain - 0.5f) * 0.15f;
                float seamU = Mathf.Min(fu, 1 - fu) * size / cols, seamV = Mathf.Min(fv, 1 - fv) * size / per;
                if (seamU < 1.2f || seamV < 1.0f) { c = Shade(c, 0.8f); h = 0.2f; }
                return P(c, h);
            }, 2.4f, true, 0.6f);
        }

        /// <summary>Chêne à fil vertical (armoire, portes, plateau de table).</summary>
        public static TexSet Oak(int seed, Color baseCol, int size = 512)
        {
            var n = new PeriodicNoise(seed);
            return Paint(size, (u, v, x, y) =>
            {
                float g = n.Fbm(u, v, 48, 3, 4);
                float ring = Mathf.Sin((u * 36 + g * 5) * Mathf.PI * 2) * 0.5f + 0.5f;
                float fine = n.Noise(u * 256, v * 6, 256, 6);
                return P(Shade(baseCol, 0.86f + g * 0.18f + ring * 0.07f + (fine - 0.5f) * 0.06f), 0.5f + ring * 0.15f);
            }, 1.2f, true, 0.3f);
        }

        public static TexSet Slats(int size = 512)
        {
            var n = new PeriodicNoise(77);
            return Paint(size, (u, v, x, y) =>
            {
                float k = (u * 8) % 1f;
                float g = n.Fbm(u, v, 64, 3, 4);
                if (k > 0.78f) return P(Rgb(28, 20, 14), 0f);
                return P(Shade(Rgb(150, 96, 52), 0.82f + g * 0.3f), 0.7f);
            }, 0.4f, true, 2f);
        }

        /* ----------------------------- Marbres ----------------------------- */

        /// <summary>Grès cérame effet marbre de Carrare avec joints.</summary>
        public static TexSet MarbleWhite(int size = 1024, float meters = 1.2f)
        {
            var n = new PeriodicNoise(23);
            var baseCol = Rgb(236, 236, 238);
            var vein = Rgb(110, 112, 118);
            return Paint(size, (u, v, x, y) =>
            {
                float t = n.Fbm(u, v, 6, 6, 6), t2 = n.Fbm(u + 0.3f, v + 0.7f, 10, 10, 5);
                float a = Mathf.Abs(Mathf.Sin(Mathf.PI * 2 * (u + v * 2) + t * 9));
                float b = Mathf.Abs(Mathf.Sin(Mathf.PI * 2 * (u * 3 - v) + t2 * 12));
                float vn = Mathf.Pow(1 - a, 28) * 0.75f + Mathf.Pow(1 - b, 60) * 0.5f;
                float cloud = n.Fbm(u, v, 4, 4, 4);
                var c = Color.Lerp(Shade(baseCol, 0.97f + (cloud - 0.5f) * 0.06f), vein, Mathf.Min(1, vn));
                if (x < 2 || y < 2) return P(Rgb(200, 200, 200), 0.2f);
                return P(c, 0.7f);
            }, meters, true, 0.5f);
        }

        /// <summary>Marbre noir veiné de blanc (crédence, plan de travail).</summary>
        public static TexSet MarbleBlack(int size = 1024)
        {
            var n = new PeriodicNoise(31);
            return Paint(size, (u, v, x, y) =>
            {
                float t = n.Fbm(u, v, 5, 5, 6), t2 = n.Fbm(u + 0.5f, v, 9, 9, 5);
                float a = Mathf.Abs(Mathf.Sin(Mathf.PI * 2 * (u * 2 + v) + t * 10));
                float b = Mathf.Abs(Mathf.Sin(Mathf.PI * 2 * (u - v * 3) + t2 * 14));
                float vn = Mathf.Pow(1 - a, 40) + Mathf.Pow(1 - b, 90) * 0.7f + Mathf.Pow(1 - a, 8) * 0.06f;
                return P(Color.Lerp(Rgb(14, 14, 16), Rgb(225, 225, 228), Mathf.Min(1, vn)));
            }, 1f, false);
        }

        /* ------------------------- Murs et textiles ------------------------- */

        public static TexSet PaintWall(int size = 256)
        {
            var n = new PeriodicNoise(3);
            return Paint(size, (u, v, x, y) =>
            {
                float g = n.Fbm(u, v, 16, 16, 4);
                return P(Shade(Rgb(243, 242, 239), 0.975f + g * 0.04f), g);
            }, 1f, true, 0.3f);
        }

        public static TexSet Plaster(int size = 512)
        {
            var n = new PeriodicNoise(4);
            return Paint(size, (u, v, x, y) =>
            {
                float g = n.Fbm(u, v, 12, 12, 6), s = n.Noise(u * 96, v * 96, 96, 96);
                return P(Shade(Rgb(236, 232, 224), 0.92f + g * 0.1f + (s - 0.5f) * 0.04f), g * 0.8f + s * 0.2f);
            }, 1.2f, true, 3f);
        }

        public static TexSet Boucle(int size = 512)
        {
            var n = new PeriodicNoise(8);
            return Paint(size, (u, v, x, y) =>
            {
                float a = n.Noise(u * 128, v * 128, 128, 128), b = n.Noise(u * 64 + 7, v * 64, 64, 64);
                float loops = Mathf.Pow(Mathf.Abs(Mathf.Sin(a * 9 + b * 6)), 0.6f);
                return P(Shade(Rgb(212, 202, 188), 0.78f + loops * 0.28f), loops);
            }, 0.18f, true, 3f);
        }

        public static TexSet Felt(int size = 512)
        {
            var n = new PeriodicNoise(9);
            return Paint(size, (u, v, x, y) =>
            {
                float g = n.Fbm(u, v, 64, 64, 4), f = n.Noise(u * 256, v * 256, 256, 256);
                return P(Shade(Rgb(118, 110, 101), 0.9f + g * 0.16f + (f - 0.5f) * 0.08f), f);
            }, 0.5f, true, 1.5f);
        }

        public static TexSet Linen(Color baseCol, int seed, float meters = 0.25f, int size = 256)
        {
            var n = new PeriodicNoise(seed);
            return Paint(size, (u, v, x, y) =>
            {
                int w = ((x % 4) < 2 ? 1 : 0) ^ ((y % 4) < 2 ? 1 : 0);
                float g = n.Fbm(u, v, 16, 16, 3);
                return P(Shade(baseCol, 0.94f + w * 0.04f + g * 0.06f), w * 0.5f + g * 0.5f);
            }, meters, true, 0.8f);
        }

        public static TexSet Awning(int size = 512)
        {
            var n = new PeriodicNoise(13);
            return Paint(size, (u, v, x, y) =>
            {
                float g = n.Fbm(u, v, 8, 8, 4);
                return P(Shade(Rgb(214, 128, 62), (0.9f + g * 0.15f) * (x % 3 == 0 ? 0.95f : 1f)), g);
            }, 1f, true, 0.6f);
        }

        /// <summary>Voilage : la couleur porte l'alpha (rideau semi-transparent).</summary>
        public static TexSet Sheer(int size = 256)
        {
            var n = new PeriodicNoise(14);
            var set = Paint(size, (u, v, x, y) =>
            {
                float g = n.Noise(u * 64, v * 2, 64, 2);
                float k = 0.8f + g * 0.2f;
                var c = Rgb(196 * k, 196 * k, 200 * k);
                c.a = 0.55f + g * 0.35f;
                return P(c);
            }, 0.5f, false);
            return set;
        }

        /* ----------------------------- Extérieur ----------------------------- */

        /// <summary>Gazon synthétique : milliers de brins tracés.</summary>
        public static TexSet Grass(int size = 512)
        {
            var c = new Color[size * size];
            var h = new float[size * size];
            var bg = Rgb(63, 122, 37);
            for (int i = 0; i < c.Length; i++) c[i] = bg;
            var r = new System.Random(99);
            for (int i = 0; i < 26000; i++)
            {
                float x = (float)r.NextDouble() * size, y = (float)r.NextDouble() * size;
                float len = 3 + (float)r.NextDouble() * 7;
                float ang = -Mathf.PI / 2 + ((float)r.NextDouble() - 0.5f) * 1.4f;
                float g = 110 + (float)r.NextDouble() * 100;
                var col = Rgb(g * 0.48f, g, g * 0.22f);
                float hv = 0.45f + (float)r.NextDouble() * 0.55f;
                Raster.Line(c, h, size, size, x, y, x + Mathf.Cos(ang) * len, y + Mathf.Sin(ang) * len, col, hv);
            }
            return Raster.ToSet(c, h, size, size, 0.6f, 4f);
        }

        /// <summary>Mur végétal : feuilles de lierre superposées.</summary>
        public static TexSet Ivy(int size = 1024)
        {
            var c = new Color[size * size];
            var h = new float[size * size];
            var bg = Rgb(19, 36, 18);
            for (int i = 0; i < c.Length; i++) c[i] = bg;
            var r = new System.Random(42);
            const int count = 9000;
            for (int i = 0; i < count; i++)
            {
                float x = (float)r.NextDouble() * size, y = (float)r.NextDouble() * size;
                float s = 6 + (float)r.NextDouble() * 9, a = (float)r.NextDouble() * Mathf.PI * 2;
                float depth = (float)i / count;
                float g = 60 + depth * 110 + (float)r.NextDouble() * 40;
                var col = Rgb(g * (0.35f + (float)r.NextDouble() * 0.25f), g, g * (0.2f + (float)r.NextDouble() * 0.2f));
                Raster.Leaf(c, h, size, size, x, y, s, a, col, 0.15f + depth * 0.85f);
            }
            return Raster.ToSet(c, h, size, size, 1.4f, 5f);
        }

        public static TexSet Rattan(int size = 256)
        {
            var n = new PeriodicNoise(17);
            const int cell = 16;
            return Paint(size, (u, v, x, y) =>
            {
                bool horiz = ((x / cell) + (y / cell)) % 2 == 0;
                float across = horiz ? (y % cell) / (float)cell : (x % cell) / (float)cell;
                float hh = Mathf.Abs(Mathf.Sin(across * Mathf.PI * 3));
                float g = n.Noise(u * 64, v * 64, 64, 64);
                return P(Shade(Rgb(150, 122, 90), 0.6f + hh * 0.5f + (g - 0.5f) * 0.12f), hh);
            }, 0.16f, true, 3f);
        }

        /// <summary>Feuille tropicale avec alpha (bananier ou palme).</summary>
        public static Texture2D Leaf(bool banana, int seed)
        {
            const int W = 128, Hh = 256;
            var px = new Color32[W * Hh];
            var r = new System.Random(seed);
            for (int y = 0; y < Hh; y++)
            {
                float t = (float)y / Hh; // 0 = base, 1 = pointe
                for (int x = 0; x < W; x++)
                {
                    float u = (x - W / 2f) / (W / 2f);
                    Color c = new Color(0, 0, 0, 0);
                    if (banana)
                    {
                        float half = Mathf.Sin(Mathf.Pow(t, 0.8f) * Mathf.PI) * 0.92f;
                        if (Mathf.Abs(u) < half)
                        {
                            float vein = Mathf.Abs(Mathf.Sin((t * 40 + Mathf.Abs(u) * 6) * Mathf.PI));
                            float g = 0.75f + 0.25f * (1 - Mathf.Abs(u)) - vein * 0.08f;
                            c = new Color(0.2f * g, 0.45f * g, 0.14f * g, 1f);
                            if (Mathf.Abs(u) < 0.035f) c = new Color(0.72f, 0.84f, 0.54f, 1f);
                        }
                    }
                    else
                    {
                        float k = (t * 34) % 1f;
                        float len = Mathf.Sin(t * Mathf.PI) * 0.95f;
                        bool rib = Mathf.Abs(u) < 0.04f;
                        bool leaflet = Mathf.Abs(u) < len && Mathf.Abs(k - 0.5f - Mathf.Abs(u) * 0.35f) < 0.22f;
                        if (rib || leaflet) c = new Color(0.25f, 0.5f, 0.18f, 1f);
                    }
                    px[y * W + x] = c;
                }
            }
            var tex = NewTex(W, Hh, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            tex.SetPixels32(px);
            tex.Apply(true);
            return tex;
        }

        /// <summary>Écran TV allumé : interface de streaming générique (bannière + vignettes).</summary>
        public static Texture2D TvScreen()
        {
            const int W = 512, Hh = 288;
            var px = new Color[W * Hh];
            var r = new System.Random(7);
            var tiles = new Color[12];
            for (int i = 0; i < 12; i++) tiles[i] = Color.HSVToRGB((float)r.NextDouble(), 0.55f, 0.45f);
            for (int y = 0; y < Hh; y++)
                for (int x = 0; x < W; x++)
                {
                    float ty = 1 - (float)y / Hh; // 0 = haut
                    Color c = Color.Lerp(new Color(0.09f, 0.09f, 0.1f), new Color(0.02f, 0.02f, 0.03f), ty);
                    if (ty < 0.52f) c = Color.Lerp(new Color(0.23f, 0.06f, 0.06f), new Color(0.11f, 0.16f, 0.27f), (float)x / W);
                    if (ty > 0.16f && ty < 0.24f && x > 24 && x < 200) c = new Color(0.9f, 0.04f, 0.08f); // logo
                    if (ty > 0.36f && ty < 0.44f && x > 26 && x < 96) c = Color.white;               // bouton Lecture
                    if (ty > 0.62f)
                    {
                        int col = (x - 24) / 79, row = ty < 0.81f ? 0 : 1;
                        float lx = (x - 24) % 79, ly = ty < 0.81f ? ty - 0.62f : ty - 0.81f;
                        if (x >= 24 && col < 6 && lx < 74 && ly < 0.17f) c = tiles[row * 6 + col] * (1 - ly * 2.5f);
                    }
                    px[y * W + x] = c;
                }
            var tex = NewTex(W, Hh, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            tex.SetPixels(px);
            tex.Apply(true);
            return tex;
        }

        public static Texture2D WaterNormals(int size = 256)
        {
            var n = new PeriodicNoise(51);
            var h = new float[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    h[y * size + x] = n.Fbm((float)x / size, (float)y / size, 8, 8, 4);
            return HeightToNormal(h, size, size, 6f);
        }
    }

    /// <summary>Petites primitives de dessin dans un tableau de pixels (bouclage aux bords).</summary>
    public static class Raster
    {
        static void Plot(Color[] c, float[] h, int w, int hh, int x, int y, Color col, float hv)
        {
            x = ((x % w) + w) % w; y = ((y % hh) + hh) % hh;
            c[y * w + x] = col; h[y * w + x] = hv;
        }

        public static void Line(Color[] c, float[] h, int w, int hh, float x0, float y0, float x1, float y1, Color col, float hv)
        {
            int steps = Mathf.CeilToInt(Mathf.Max(Mathf.Abs(x1 - x0), Mathf.Abs(y1 - y0))) + 1;
            for (int i = 0; i <= steps; i++)
            {
                float t = (float)i / steps;
                Plot(c, h, w, hh, Mathf.RoundToInt(Mathf.Lerp(x0, x1, t)), Mathf.RoundToInt(Mathf.Lerp(y0, y1, t)), col, hv);
            }
        }

        /// <summary>Feuille de lierre stylisée (trois lobes) remplie.</summary>
        public static void Leaf(Color[] c, float[] h, int w, int hh, float cx, float cy, float s, float a, Color col, float hv)
        {
            float ca = Mathf.Cos(a), sa = Mathf.Sin(a);
            int r = Mathf.CeilToInt(s * 1.2f);
            for (int dy = -r; dy <= r; dy++)
                for (int dx = -r; dx <= r; dx++)
                {
                    float lx = (dx * ca + dy * sa) / s, ly = (-dx * sa + dy * ca) / s;
                    float ang = Mathf.Atan2(ly, lx);
                    float rad = 0.75f + 0.25f * Mathf.Cos(3 * ang);
                    if (lx * lx + ly * ly > rad * rad) continue;
                    float shade = 0.85f + 0.15f * (1 - (lx * lx + ly * ly));
                    Plot(c, h, w, hh, Mathf.RoundToInt(cx + dx), Mathf.RoundToInt(cy + dy), col * shade, hv);
                }
        }

        public static TexSet ToSet(Color[] c, float[] h, int w, int hh, float meters, float strength)
        {
            var set = new TexSet { Meters = new Vector2(meters, meters), NormalStrength = strength };
            set.Albedo = new Texture2D(w, hh, TextureFormat.RGBA32, true, false) { wrapMode = TextureWrapMode.Repeat, anisoLevel = 8 };
            for (int i = 0; i < c.Length; i++) c[i].a = 1f;
            set.Albedo.SetPixels(c);
            set.Albedo.Apply(true);
            set.Normal = ProceduralTextures.HeightToNormal(h, w, hh, 2f);
            return set;
        }
    }
}

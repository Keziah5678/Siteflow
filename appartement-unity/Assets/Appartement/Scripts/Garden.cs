using System.Collections.Generic;
using UnityEngine;
using static Appartement.Layout;

namespace Appartement
{
    /// <summary>Jardin : gazon, murs végétaux, store banne, salon de jardin, spa, végétation, arrière-plan.</summary>
    public static class GardenBuilder
    {
        const float WallH = 2.55f;
        static readonly List<(Material mat, Color col, float intensity)> leds = new List<(Material, Color, float)>();
        static Light lanternLight, spaLight;
        static readonly Color LedCol = new Color(1f, 0.79f, 0.52f);

        public static void Build(Builder b)
        {
            leds.Clear();
            var g = b.Group(b.Root, "Jardin");
            var m = b.M;
            b.Slab(Garden.X0, Garden.X1, -0.15f, -0.008f, Garden.Z0, Garden.Z1, m.Grass, g, true, false, "gazon");
            var ground = b.Slab(-55, 65, -0.1f, -0.05f, -58, 62, m.Ground, g, false, false, "sol environnant");
            ground.GetComponent<MeshRenderer>().receiveShadows = true;
            GreenWalls(b, g);
            Awning(b, g);
            Lounge(b, g);
            Jacuzzi(b, g);
            Facade(b, g);
            Plants(b, g);
            Surroundings(b, g);
            Lights(b, g);
            b.MarkOutdoor(g);
        }

        static Material Led(float intensity)
        {
            var mat = Mat.Emissive(LedCol, intensity);
            leds.Add((mat, LedCol, intensity));
            return mat;
        }

        /* --------------- Murs végétaux sur soubassement blanc (photo 6) --------------- */

        static void GreenWalls(Builder b, Transform g)
        {
            var m = b.M;
            const float t = 0.2f, baseH = 0.42f;
            float wx = Garden.X1, zn = Garden.Z0, zs = Garden.Z1;
            var walls = new[]
            {
                new Vector4(Garden.X0 - T, wx + t, zn - t, zn),
                new Vector4(wx, wx + t, zn - t, zs + t),
                new Vector4(Bath.X1 + T, wx + t, zs, zs + t),
            };
            var top = Mat.Lit(new Color(0.91f, 0.9f, 0.87f), 0.1f);
            foreach (var w in walls)
            {
                b.Slab(w.x, w.y, 0, baseH, w.z, w.w, m.Plaster, g, true, true, "soubassement");
                b.Slab(w.x, w.y, baseH, WallH, w.z, w.w, m.Ivy, g, true, true, "mur végétal");
                b.Slab(w.x, w.y, WallH, WallH + 0.04f, w.z, w.w, top, g, false);
            }
            const float sill = 0.05f;
            b.Slab(Garden.X0, wx, 0, baseH, zn, zn + sill, m.Plaster, g, false);
            b.Slab(wx - sill, wx, 0, baseH, zn, zs, m.Plaster, g, false);
            b.Slab(Bath.X1 + T, wx, 0, baseH, zs - sill, zs, m.Plaster, g, false);
            var led = Led(5f);
            for (float x = 5.2f; x < wx - 0.5f; x += 1.6f) b.Strip(0.025f, WallH - baseH - 0.1f, 0.02f, x, (WallH + baseH) / 2, zn + 0.01f, g, led);
            for (float z = -0.6f; z < zs - 0.5f; z += 1.6f) b.Strip(0.02f, WallH - baseH - 0.1f, 0.025f, wx - 0.01f, (WallH + baseH) / 2, z, g, led);
            for (float x = 6.0f; x < wx - 0.5f; x += 1.6f) b.Strip(0.025f, WallH - baseH - 0.1f, 0.02f, x, (WallH + baseH) / 2, zs - 0.01f, g, led);
        }

        /* -------------------- Store banne orange motorisé (photo 8) -------------------- */

        static void Awning(Builder b, Transform g)
        {
            var m = b.M;
            float x0 = Room.X1 + T, z0 = -0.9f, z1 = 4.15f, yTop = 2.85f, proj = 3.1f, drop = 0.42f, width = z1 - z0;
            var grp = b.Group(g, "store banne");
            b.Slab(x0, x0 + 0.2f, yTop - 0.08f, yTop + 0.14f, z0 - 0.1f, z1 + 0.1f, m.WhitePlastic, grp, false);
            var fabricMesh = new Mesh { name = "toile" };
            var fabric = b.MeshObj(fabricMesh, m.Awning, grp, Vector3.zero, true, "toile");
            fabric.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.TwoSided;
            var bar = b.Box(0.08f, 0.1f, width + 0.1f, m.WhitePlastic, 0, 0, 0, grp, false, "barre de charge");
            var arms = new List<Transform>();
            foreach (var z in new[] { z0 + 0.3f, z1 - 0.3f })
            {
                var a = b.Group(grp, "bras", 0, 0, z);
                b.Box(1f, 0.04f, 0.05f, m.WhitePlastic, 0, 0, 0, a);
                arms.Add(a);
            }
            var led = Led(7f);
            b.Strip(0.015f, 0.015f, width, x0 + 0.05f, yTop - 0.1f, (z0 + z1) / 2, grp, led);
            const int seg = 20;
            void Apply(float k)
            {
                float L = 0.12f + proj * k;
                var pts = new Vector3[2, seg + 1];
                for (int i = 0; i < 2; i++)
                    for (int j = 0; j <= seg; j++)
                    {
                        float v = (float)j / seg;
                        float sag = Mathf.Sin(v * Mathf.PI) * 0.06f * k;
                        pts[i, j] = new Vector3(x0 + 0.1f + v * L, yTop - v * drop * k - sag, z0 + i * width);
                    }
                MeshGen.FillGrid(fabricMesh, pts, Vector3.down, Vector3.zero);
                float ex = x0 + 0.1f + L, ey = yTop - drop * k;
                bar.transform.localPosition = new Vector3(ex, ey - 0.03f, (z0 + z1) / 2);
                foreach (var a in arms)
                {
                    float sx = x0 + 0.12f, sy = yTop - 0.35f, dx = ex - sx, dy = ey - 0.05f - sy;
                    a.localPosition = new Vector3((sx + ex) / 2, (sy + ey - 0.05f) / 2, a.localPosition.z);
                    a.localScale = new Vector3(Mathf.Max(0.05f, Mathf.Sqrt(dx * dx + dy * dy)), 1, 1);
                    a.localRotation = Quaternion.Euler(0, 0, Mathf.Atan2(dy, dx) * Mathf.Rad2Deg);
                    a.gameObject.SetActive(k > 0.03f);
                }
            }
            // Replié par défaut : le soleil du matin entre par la baie (photo 2).
            var anim = new Toggle(3.5f, Apply, 0);
            b.Updaters.Add((dt, t) => { if (anim.Update(dt)) b.DirtyReflections(); });
            var sw = b.Group(grp, "commande store", x0 + 0.001f, 1.15f, SliderZ1 + 0.32f, 90);
            b.Box(0.08f, 0.14f, 0.02f, m.WhitePlastic, 0, 0, 0.01f, sw);
            b.Box(0.05f, 0.04f, 0.01f, m.Anthracite, 0, 0.035f, 0.022f, sw);
            b.Box(0.05f, 0.04f, 0.01f, m.Anthracite, 0, -0.035f, 0.022f, sw);
            b.Interactive(sw, () => anim.On ? "Replier le store banne" : "Déployer le store banne", () =>
            {
                anim.Flip(); b.Sound.Slide();
                b.Notify(anim.On ? "Le store se déploie…" : "Le store se replie…");
            }, 3.5f);
        }

        /* ---------------- Salon de jardin blanc laqué, table, lanterne (photo 8) ---------------- */

        static void Lounge(Builder b, Transform g)
        {
            var m = b.M;
            float x0 = Room.X1 + T;
            var grp = b.Group(g, "salon de jardin");
            b.RBox(0.75f, 0.38f, 1.6f, 0.03f, m.WhiteGloss, x0 + 0.42f, 0.19f, 3.55f, grp);
            b.RBox(0.66f, 0.12f, 1.5f, 0.05f, m.CushionBeige, x0 + 0.44f, 0.44f, 3.55f, grp);
            b.RBox(0.18f, 0.45f, 1.5f, 0.06f, m.CushionBeige, x0 + 0.12f, 0.66f, 3.55f, grp).transform.localRotation = Quaternion.Euler(0, 0, -6.9f);
            b.RBox(1.6f, 0.38f, 0.75f, 0.03f, m.WhiteGloss, x0 + 1.55f, 0.19f, 4.0f, grp);
            b.RBox(1.5f, 0.12f, 0.66f, 0.05f, m.CushionBeige, x0 + 1.55f, 0.44f, 4.0f, grp);
            b.RBox(1.5f, 0.45f, 0.18f, 0.06f, m.CushionBeige, x0 + 1.55f, 0.66f, 4.3f, grp).transform.localRotation = Quaternion.Euler(6.9f, 0, 0);
            b.Collider(x0, x0 + 0.8f, 0, 0.9f, 2.74f, 4.4f, grp, "collision banquette");
            b.Collider(x0 + 0.75f, x0 + 2.36f, 0, 0.9f, 3.6f, 4.4f, grp, "collision banquette");
            float tx = x0 + 1.45f, tz = 2.95f;
            b.RBox(0.85f, 0.4f, 0.85f, 0.02f, m.WhiteGloss, tx, 0.2f, tz, grp);
            b.Box(0.87f, 0.012f, 0.87f, m.Glass, tx, 0.406f, tz, grp);
            b.Collider(tx - 0.44f, tx + 0.44f, 0, 0.42f, tz - 0.44f, tz + 0.44f, grp, "collision table");
            b.Cyl(0.07f, 0.06f, 0.035f, m.Glass, tx + 0.15f, 0.43f, tz - 0.1f, grp, 20);
            var lan = b.Group(grp, "lanterne", tx - 0.25f, 0.412f, tz + 0.2f);
            b.Cyl(0.07f, 0.08f, 0.03f, m.BlackMetal, 0, 0.015f, 0, lan, 16);
            b.Cyl(0.06f, 0.06f, 0.2f, m.Glass, 0, 0.13f, 0, lan, 16, false);
            b.Cyl(0.04f, 0.08f, 0.06f, m.BlackMetal, 0, 0.26f, 0, lan, 16);
            var flame = Led(8f);
            Mat.SetEmission(flame, new Color(1f, 0.63f, 0.25f), 8f);
            leds[leds.Count - 1] = (flame, new Color(1f, 0.63f, 0.25f), 8f);
            var f = b.MeshObj(MeshGen.Sphere(0.012f, 8), flame, lan, new Vector3(0, 0.11f, 0), false, "flamme");
            f.transform.localScale = new Vector3(1, 2, 1);
            lanternLight = b.PointLight(lan, new Vector3(0, 0.15f, 0), new Color(1f, 0.6f, 0.25f), 0.5f, 3f);
        }

        /* ------------- Spa gonflable octogonal + entourage tressé (photo 6) ------------- */

        static void Jacuzzi(Builder b, Transform g)
        {
            var m = b.M;
            float x = JacuzziX, z = JacuzziZ, r = JacuzziR;
            var grp = b.Group(g, "spa", x, 0, z, 22.5f);
            b.Cyl(r, r, 0.62f, m.JacuzziShell, 0, 0.31f, 0, grp, 8);
            var liner = b.Cyl(r - 0.1f, r - 0.1f, 0.6f, m.JacuzziLiner, 0, 0.36f, 0, grp, 8, false);
            // Paroi intérieure : on retourne le cylindre (normales vers l'intérieur)
            var mesh = liner.GetComponent<MeshFilter>().sharedMesh;
            var tris = mesh.triangles;
            for (int i = 0; i < tris.Length; i += 3) { int k = tris[i + 1]; tris[i + 1] = tris[i + 2]; tris[i + 2] = k; }
            var nrm = mesh.normals;
            for (int i = 0; i < nrm.Length; i++) nrm[i] = -nrm[i];
            mesh.triangles = tris;
            mesh.normals = nrm;
            var rim = b.MeshObj(MeshGen.Torus(r - 0.06f, 0.09f, 8, 12, Vector3.zero), m.JacuzziShell, grp, new Vector3(0, 0.66f, 0), true, "bouée");
            rim.transform.localRotation = Quaternion.Euler(0, 22.5f, 0);
            var water = b.Cyl(r - 0.1f, r - 0.1f, 0.01f, m.Water, 0, 0.56f, 0, grp, 8);
            water.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            spaLight = b.PointLight(grp, new Vector3(0, 0.45f, 0), new Color(0.37f, 0.85f, 1f), 0.6f, 2.5f);
            var bubblesGo = new GameObject("bulles");
            bubblesGo.transform.SetParent(grp, false);
            bubblesGo.transform.localPosition = new Vector3(0, 0.57f, 0);
            var bubbles = Effects.Bubbles(bubblesGo, r - 0.2f);
            bool jets = false;
            float offset = 0;
            b.Updaters.Add((dt, t) =>
            {
                offset += dt * (jets ? 0.25f : 0.02f);
                m.Water.SetTextureOffset("_BumpMap", new Vector2(offset, offset * 0.7f));
                m.Water.SetFloat("_BumpScale", jets ? 1.1f : 0.35f);
            });
            var col = grp.gameObject.AddComponent<CapsuleCollider>();
            col.radius = r + 0.02f;
            col.height = 3f; // partie cylindrique de -0,5 à +0,5 m : bloque le joueur sur toute la hauteur utile
            col.direction = 1;
            b.Interactive(grp, () => jets ? "Arrêter les bulles du spa" : "Activer les bulles du spa", () =>
            {
                jets = !jets;
                if (jets) bubbles.Play(); else bubbles.Stop();
                b.Sound.Slide();
                b.Notify(jets ? "Spa : jets de massage activés — eau à 37 °C" : "Spa : jets arrêtés");
            }, 3f);

            // Entourage en résine tressée : étagère, banquette, marche
            var sur = b.Group(g, "entourage spa", x, 0, z);
            float r0 = r + 0.04f, r1 = r + 0.62f, deg = Mathf.Deg2Rad;
            void Arc(float a, float c, float lo, float hi, float h, Material mat, float y)
            {
                b.MeshObj(MeshGen.Arc(lo, hi, a * deg, c * deg, h, new Vector3(x, y, z)), mat, sur, new Vector3(0, y, 0), true, "module tressé");
            }
            Arc(196, 222, r0, r1, 0.82f, m.Rattan, 0);
            Arc(199, 219, r0 + 0.04f, r1 - 0.04f, 0.02f, m.BlackMatte, 0.4f);
            Arc(202, 216, r0 + 0.12f, r1 - 0.12f, 0.1f, m.BlueTowel, 0.42f);
            Arc(138, 194, r0, r1, 0.4f, m.Rattan, 0);
            Arc(139, 193, r0 + 0.03f, r1 - 0.03f, 0.12f, m.CushionBeige, 0.4f);
            Arc(139, 193, r1 - 0.12f, r1 - 0.03f, 0.42f, m.CushionBeige, 0.5f);
            Arc(104, 136, r0, r1 - 0.08f, 0.42f, m.Rattan, 0);
            var sc = sur.gameObject.AddComponent<CapsuleCollider>();
            sc.radius = r1;
            sc.height = 2f * r1 + 1.2f;
            sc.direction = 1;
            sur.gameObject.layer = 2;
        }

        /* ------------- Façade : chauffe-eau, groupe de clim, appliques (photo 8) ------------- */

        static void Facade(Builder b, Transform g)
        {
            var m = b.M;
            float x0 = Room.X1 + T;
            b.Cyl(0.22f, 0.22f, 0.8f, m.WhitePlastic, x0 + 0.24f, 2.1f, -0.45f, g, 32);
            b.Box(0.04f, 0.3f, 0.04f, m.WhitePlastic, x0 + 0.1f, 1.6f, -0.45f, g);
            b.Collider(x0, x0 + 0.48f, 1.65f, 2.55f, -0.7f, -0.2f, g, "collision chauffe-eau");
            var ac = b.Group(g, "groupe de climatisation", x0 + 0.2f, 2.25f, 4.0f);
            b.Box(0.3f, 0.55f, 0.75f, m.WhitePlastic, 0, 0, 0, ac);
            b.Cyl(0.19f, 0.19f, 0.01f, m.BlackMatte, 0.153f, 0, 0.1f, ac, 32).transform.localRotation = Quaternion.Euler(0, 0, 90);
            b.Collider(x0, x0 + 0.4f, 1.9f, 2.6f, 3.6f, 4.4f, g, "collision clim");
            var wallLed = Led(5f);
            foreach (var z in new[] { 0.1f, 3.0f })
            {
                b.Box(0.08f, 0.12f, 0.08f, m.Anthracite, x0 + 0.04f, 2.05f, z, g);
                b.Box(0.06f, 0.005f, 0.06f, wallLed, x0 + 0.04f, 1.988f, z, g);
            }
        }

        /* ----------------------- Végétation (photo 6) ----------------------- */

        static Transform Plant(Builder b, Transform parent, Vector3 pos, bool banana, float scale, int seed, float facingDeg, float spreadDeg)
        {
            var grp = b.Group(parent, banana ? "bananier" : "palme", pos.x, pos.y, pos.z);
            var rnd = new System.Random(seed);
            int n = banana ? 7 : 9;
            float len = (banana ? 0.9f : 0.7f) * scale;
            // Feuille courbée : grille 2 × 5 qui se cambre vers l'avant
            var mesh = new Mesh { name = "feuille" };
            var pts = new Vector3[2, 5];
            for (int i = 0; i < 2; i++)
                for (int j = 0; j < 5; j++)
                {
                    float v = j / 4f;
                    pts[i, j] = new Vector3((i - 0.5f) * len * 0.5f, v * len, v * v * 0.35f * len);
                }
            MeshGen.FillGrid(mesh, pts, Vector3.forward, Vector3.zero);
            mesh.uv = new[] { new Vector2(0, 0), new Vector2(0, 0.25f), new Vector2(0, 0.5f), new Vector2(0, 0.75f), new Vector2(0, 1),
                              new Vector2(1, 0), new Vector2(1, 0.25f), new Vector2(1, 0.5f), new Vector2(1, 0.75f), new Vector2(1, 1) };
            var mat = banana ? b.M.LeafBanana : b.M.LeafPalm;
            for (int i = 0; i < n; i++)
            {
                var leaf = b.MeshObj(mesh, mat, grp, Vector3.zero, true, "feuille");
                float yaw = facingDeg + ((float)rnd.NextDouble() - 0.5f) * spreadDeg;
                float pitch = banana ? 14 + (float)rnd.NextDouble() * 46 : 52 + (float)rnd.NextDouble() * 68;
                float roll = ((float)rnd.NextDouble() - 0.5f) * 34;
                leaf.transform.localRotation = Quaternion.Euler(pitch, yaw, roll);
            }
            return grp;
        }

        static void Plants(Builder b, Transform g)
        {
            float zN = Garden.Z0 + 0.03f, xE = Garden.X1 - 0.03f, zS = Garden.Z1 - 0.03f;
            var spots = new (float x, float y, float z, bool banana, float facing)[]
            {
                (4.4f, 1.7f, zN, true, 0), (5.9f, 2.1f, zN, false, 0), (6.6f, 1.3f, zN, true, 0), (7.9f, 1.9f, zN, false, 0),
                (8.6f, 1.45f, zN, true, 0), (9.7f, 2.2f, zN, false, 0),
                (xE, 1.8f, 0.3f, true, -90), (xE, 2.15f, 1.4f, false, -90), (xE, 1.3f, 2.4f, true, -90), (xE, 2.0f, 3.5f, false, -90),
                (6.4f, 1.6f, zS, true, 180), (7.6f, 2.2f, zS, false, 180), (8.8f, 1.4f, zS, true, 180),
            };
            for (int i = 0; i < spots.Length; i++)
            {
                var s = spots[i];
                Plant(b, g, new Vector3(s.x, s.banana ? s.y - 0.4f : s.y, s.z), s.banana, s.banana ? 0.9f : 0.8f, 100 + i, s.facing, s.banana ? 92 : 126);
            }
        }

        /* --------------- Arrière-plan : immeubles lointains et palmiers --------------- */

        static void Surroundings(Builder b, Transform g)
        {
            var m = b.M;
            var grp = b.Group(g, "environs");
            var blocks = new[] { new Vector4(24, 32, -14, -4), new Vector4(26, 34, 8, 18), new Vector4(-6, 2, -22, -12) };
            var heights = new[] { 7f, 9f, 8f };
            for (int i = 0; i < blocks.Length; i++)
                b.Slab(blocks[i].x, blocks[i].y, 0, heights[i], blocks[i].z, blocks[i].w, m.Plaster, grp, false);
            var palms = new[] { new Vector3(13.5f, 1.0f, 6.5f), new Vector3(12.8f, -4.2f, 7.2f), new Vector3(7.5f, -4.6f, 6.0f), new Vector3(15f, 5.5f, 8f) };
            for (int i = 0; i < palms.Length; i++)
            {
                float x = palms[i].x, z = palms[i].y, h = palms[i].z;
                var trunk = b.Cyl(0.11f, 0.18f, h, m.Trunk, x, h / 2, z, grp, 10);
                trunk.transform.localRotation = Quaternion.Euler(0, 0, (i % 2 == 1 ? 1 : -1) * 3.4f);
                Plant(b, grp, new Vector3(x + (i % 2 == 1 ? -1 : 1) * h * 0.06f, h - 0.1f, z), false, 2.4f, 300 + i, 0, 360);
            }
        }

        /* --------------------- Groupe « éclairage du jardin » --------------------- */

        static void Lights(Builder b, Transform g)
        {
            var grp = b.NewLightGroup("garden", "Éclairage du jardin", true);
            foreach (var l in leds) grp.Add(l.mat, l.col, l.intensity);
            grp.Add(b.PointLight(g, new Vector3(Room.X1 + 0.6f, 2.5f, 1.6f), LedCol, 1.2f, 7f));
            grp.Add(b.PointLight(g, new Vector3(8.4f, 1.6f, 2.4f), LedCol, 0.9f, 6f));
            if (lanternLight != null) grp.Add(lanternLight);
            if (spaLight != null) grp.Add(spaLight);
            Interior.Switch(b, g, Room.X1 - 0.001f, 1.1f, SliderZ1 + 0.45f, -90, grp, "éclairage du jardin");
            Interior.Switch(b, g, Room.X1 + T + 0.001f, 1.1f, SliderZ1 + 0.18f, 90, grp, "éclairage du jardin");
        }
    }
}

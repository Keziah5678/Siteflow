using System;
using UnityEngine;
using static Appartement.Layout;

namespace Appartement
{
    /// <summary>Mobilier et équipements intérieurs, d'après les photos.</summary>
    public static class Interior
    {
        static readonly Color Warm = new Color(1f, 0.77f, 0.53f);

        public static void Build(Builder b)
        {
            var root = b.Group(b.Root, "Intérieur");
            CeilingLights(b, root);
            Headboard(b, root);
            Bed(b, root);
            Nightstands(b, root);
            AirConditioner(b, root);
            CoffeeTable(b, root);
            Wardrobe(b, root);
            Television(b, root);
            Curtains(b, root);
            Kitchen(b, root);
            Bathroom(b, root);
            Hall(b, root);
            Switches(b, root);
        }

        /* ------------------------- Éclairage principal ------------------------- */

        static void CeilingLights(Builder b, Transform root)
        {
            var g = b.NewLightGroup("ceiling", "Plafonnier", false);
            // Plafonnier rond au diffuseur ondulé
            var lamp = b.Cyl(0.25f, 0.25f, 0.07f, b.M.LampDiffuser, 1.8f, H - 0.04f, 2.2f, root, 48);
            lamp.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            g.Add(b.M.LampDiffuser, new Color(1f, 0.95f, 0.86f), 2.2f);
            var spotGo = new GameObject("plafonnier");
            spotGo.transform.SetParent(root, false);
            spotGo.transform.localPosition = new Vector3(1.8f, H - 0.09f, 2.2f);
            spotGo.transform.localRotation = Quaternion.Euler(90, 0, 0);
            var spot = spotGo.AddComponent<Light>();
            spot.type = LightType.Spot;
            spot.spotAngle = 140f;
            spot.innerSpotAngle = 60f;
            spot.range = 6f;
            spot.intensity = 2.2f;
            spot.color = new Color(1f, 0.94f, 0.86f);
            spot.shadows = LightShadows.Soft;
            g.Add(spot);
            var hallMat = Mat.Emissive(Color.white, 0f);
            b.Cyl(0.04f, 0.04f, 0.01f, hallMat, 0.5f, H - 0.004f, 5.3f, root, 16);
            g.Add(hallMat, new Color(1f, 0.95f, 0.87f), 3f);
            g.Add(b.PointLight(root, new Vector3(0.5f, H - 0.15f, 5.3f), new Color(1f, 0.94f, 0.86f), 0.9f, 4f));
        }

        /* --------------- Tête de lit capitonnée, lattes et LED (photo 1) --------------- */

        static void Headboard(Builder b, Transform root)
        {
            var g = b.Group(root, "tête de lit");
            for (int i = 0; i < 4; i++) b.RBox(0.445f, 1.96f, 0.075f, 0.03f, b.M.Felt, 0.8f + 0.225f + i * 0.45f, 0.38f + 0.98f, 0.04f, g);
            b.Box(1.8f, 0.38f, 0.06f, b.M.Felt, 1.7f, 0.19f, 0.03f, g);
            b.Box(0.25f, 2.48f, 0.03f, b.M.Slats, 0.675f, 1.24f, 0.015f, g);
            b.Box(0.25f, 2.48f, 0.03f, b.M.Slats, 2.725f, 1.24f, 0.015f, g);
            var led = Mat.Emissive(Warm, 0f);
            b.Strip(0.012f, 2.4f, 0.012f, 0.795f, 1.24f, 0.04f, g, led);
            b.Strip(0.012f, 2.4f, 0.012f, 2.605f, 1.24f, 0.04f, g, led);
            var grp = b.NewLightGroup("headboard", "LED de la tête de lit", true).Add(led, Warm, 5f);
            grp.Add(b.PointLight(g, new Vector3(0.8f, 1.3f, 0.25f), Warm, 0.35f, 2.4f));
            grp.Add(b.PointLight(g, new Vector3(2.6f, 1.3f, 0.25f), Warm, 0.35f, 2.4f));
            b.Collider(0.55f, 2.85f, 0, 2.48f, 0, 0.08f, g, "collision tête de lit");
        }

        /* --------------- Lit : sommier bouclé « bubble », couette drapée --------------- */

        static void Bed(Builder b, Transform root)
        {
            var g = b.Group(root, "lit", 1.7f, 0, 0.08f);
            const float W = 1.84f, L = 2.14f;
            b.RBox(W - 0.1f, 0.36f, L - 0.1f, 0.08f, b.M.Boucle, 0, 0.22f, L / 2, g);
            // Boudins capitonnés tout autour
            var puff = MeshGen.RoundedBox(new Vector3(0.205f, 0.38f, 0.15f), 0.07f, 4, Vector3.zero);
            var rnd = new System.Random(3);
            void Puff(float x, float z, float ry)
            {
                var go = b.MeshObj(puff, b.M.Boucle, g, new Vector3(x, 0.2f, z), true, "boudin");
                go.transform.localRotation = Quaternion.Euler(0, ry + ((float)rnd.NextDouble() - 0.5f) * 3.4f, 0);
            }
            for (float z = 0.16f; z < L - 0.1f; z += 0.205f) { Puff(-W / 2 + 0.06f, z, 90); Puff(W / 2 - 0.06f, z, 90); }
            for (float x = -W / 2 + 0.16f; x < W / 2 - 0.1f; x += 0.205f) Puff(x, L - 0.06f, 0);
            b.RBox(1.62f, 0.24f, 2.0f, 0.06f, b.M.Sheet, 0, 0.5f, 1.04f, g);
            // Couette drapée sur les côtés et au pied du lit
            var duvet = new Mesh { name = "couette" };
            MeshGen.FillGrid(duvet, Drape(0.82f, 0.04f, 2.08f, 0.3f, 0.68f), Vector3.up, Vector3.zero);
            duvet.RecalculateTangents();
            b.MeshObj(duvet, b.M.Sheet, g, Vector3.zero, true, "couette");
            foreach (var x in new[] { -0.42f, 0.42f })
            {
                var p = b.RBox(0.68f, 0.15f, 0.46f, 0.07f, b.M.Pillow, x, 0.8f, 0.3f, g, 4, "oreiller");
                p.transform.localRotation = Quaternion.Euler(-24, 0, 0);
            }
            // Serviette noire roulée (photos 1 et 2)
            var t = b.Group(g, "serviette", 0.12f, 0.72f, 1.3f, 28.6f);
            foreach (var dz in new[] { -0.07f, 0.07f })
                b.Cyl(0.075f, 0.075f, 0.34f, b.M.TowelBlack, 0, 0, dz, t, 20).transform.localRotation = Quaternion.Euler(0, 0, 90);
            b.Box(0.08f, 0.02f, 0.3f, b.M.Red, 0, 0.075f, 0, t);
            b.Collider(0.78f, 2.62f, 0, 0.7f, 0.08f, 0.08f + L, root, "collision lit");
        }

        /// <summary>Grille de la couette : plate sur le matelas, elle retombe sur les côtés et au pied.</summary>
        static Vector3[,] Drape(float halfW, float z0, float zFoot, float overhang, float top)
        {
            const int nx = 64, nz = 64;
            const float rr = 0.07f;
            var pts = new Vector3[nx + 1, nz + 1];
            (float o, float d) Fold(float e)
            {
                if (e <= 0) return (e, 0);
                float arc = Mathf.PI / 2 * rr;
                if (e < arc) { float th = e / rr; return (rr * Mathf.Sin(th), rr * (1 - Mathf.Cos(th))); }
                return (rr, rr + (e - arc));
            }
            for (int i = 0; i <= nx; i++)
                for (int j = 0; j <= nz; j++)
                {
                    float s = Mathf.Lerp(-halfW - overhang, halfW + overhang, (float)i / nx);
                    float tt = Mathf.Lerp(z0, zFoot + overhang, (float)j / nz);
                    var fx = Fold(Mathf.Abs(s) - halfW);
                    var fz = Fold(tt - zFoot);
                    float x = Mathf.Abs(s) > halfW ? Mathf.Sign(s) * (halfW + fx.o) : s;
                    float z = tt > zFoot ? zFoot + fz.o : tt;
                    float drop = Mathf.Max(fx.d, fz.d);
                    float wr = 0.006f * Mathf.Sin(s * 11 + tt * 4) * Mathf.Sin(tt * 7.3f) + 0.004f * Mathf.Sin(s * 23 - tt * 13);
                    float wave = drop > 0.02f ? 0.012f * Mathf.Sin((Mathf.Abs(s) > halfW ? tt : s) * 18) * Mathf.Min(1, drop * 6) : 0;
                    if (Mathf.Abs(s) > halfW) x += Mathf.Sign(s) * wave;
                    if (tt > zFoot) z += wave;
                    pts[i, j] = new Vector3(x, top - drop + wr, z);
                }
            return pts;
        }

        /* ------------------------ Chevets + bougie ------------------------ */

        static void Nightstands(Builder b, Transform root)
        {
            foreach (var x in new[] { 0.52f, 2.88f })
            {
                var g = b.Group(root, "chevet", x, 0, 0.27f);
                b.RBox(0.45f, 0.5f, 0.4f, 0.015f, b.M.GreyFurniture, 0, 0.27f, 0, g);
                b.Box(0.43f, 0.006f, 0.005f, b.M.BlackMatte, 0, 0.3f, 0.2f, g);
                foreach (var y in new[] { 0.17f, 0.41f }) b.Box(0.12f, 0.012f, 0.02f, b.M.BlackMetal, 0, y, 0.21f, g);
                b.Box(0.41f, 0.02f, 0.36f, b.M.BlackMatte, 0, 0.01f, 0, g);
                b.ColliderAround(g);
            }
            var cg = b.Group(root, "bougie", 0.45f, 0.52f, 0.3f);
            b.Cyl(0.035f, 0.03f, 0.07f, b.M.Glass, 0, 0.035f, 0, cg, 20, false);
            b.Cyl(0.028f, 0.028f, 0.04f, Mat.Lit(new Color(0.96f, 0.94f, 0.9f), 0.3f), 0, 0.02f, 0, cg, 16);
            var flame = Mat.Emissive(new Color(1f, 0.63f, 0.25f), 0f);
            var f = b.MeshObj(MeshGen.Sphere(0.006f, 8), flame, cg, new Vector3(0, 0.055f, 0), false, "flamme");
            f.transform.localScale = new Vector3(1, 2.2f, 1);
            var grp = b.NewLightGroup("candle", "Bougie", true).Add(flame, new Color(1f, 0.63f, 0.25f), 6f);
            grp.Add(b.PointLight(cg, new Vector3(0, 0.12f, 0.05f), new Color(1f, 0.6f, 0.25f), 0.25f, 2f));
            grp.Flicker = t => 0.85f + 0.1f * Mathf.Sin(t * 13) + 0.05f * Mathf.Sin(t * 31.7f);
            b.Interactive(cg, () => grp.On ? "Souffler la bougie" : "Allumer la bougie", () => { grp.Toggle(); b.Sound.Click(); });
        }

        /* ---------------------------- Climatiseur ---------------------------- */

        static void AirConditioner(Builder b, Transform root)
        {
            var g = b.Group(root, "climatiseur", 3.22f, 2.2f, 0.11f);
            b.RBox(0.7f, 0.27f, 0.2f, 0.05f, b.M.WhitePlastic, 0, 0, 0, g);
            b.Box(0.6f, 0.02f, 0.1f, b.M.BlackMatte, 0, -0.13f, 0.02f, g);
            var flap = b.Group(g, "volet", 0, -0.125f, 0.1f);
            b.Box(0.62f, 0.006f, 0.07f, b.M.WhitePlastic, 0, 0, -0.035f, flap);
            var ledMat = Mat.Emissive(new Color(0.25f, 0.75f, 1f), 0f);
            b.Strip(0.012f, 0.006f, 0.004f, 0.27f, -0.06f, 0.1f, g, ledMat);
            var anim = new Toggle(1.2f, k =>
            {
                flap.localRotation = Quaternion.Euler(k * 51.6f, 0, 0);
                Mat.SetEmission(ledMat, new Color(0.25f, 0.75f, 1f), k * 3f);
            });
            b.Updaters.Add((dt, t) => anim.Update(dt));
            b.Interactive(g, () => anim.On ? "Éteindre la climatisation" : "Allumer la climatisation", () =>
            {
                anim.Flip(); b.Sound.Beep();
                b.Notify(anim.On ? "Climatisation en marche — consigne 22 °C" : "Climatisation arrêtée");
            }, 3f);
        }

        /* ---------------- Table basse à plateau relevable (photo 1) ---------------- */

        static void CoffeeTable(Builder b, Transform root)
        {
            var g = b.Group(root, "table basse", 1.75f, 0, 2.72f);
            const float w = 1.0f, d = 0.52f, h = 0.42f;
            var k = b.M.BlackMatte;
            b.Box(w, 0.03f, d, k, 0, 0.05f, 0, g);
            b.Box(0.03f, h - 0.06f, d, k, -w / 2 + 0.015f, 0.06f + (h - 0.06f) / 2, 0, g);
            b.Box(0.03f, h - 0.06f, d, k, w / 2 - 0.015f, 0.06f + (h - 0.06f) / 2, 0, g);
            b.Box(w, h - 0.06f, 0.03f, k, 0, 0.06f + (h - 0.06f) / 2, -d / 2 + 0.015f, g);
            b.Box(w, h - 0.06f, 0.03f, k, 0, 0.06f + (h - 0.06f) / 2, d / 2 - 0.015f, g);
            b.Box(w - 0.06f, 0.02f, d - 0.06f, k, 0, 0.24f, 0, g);
            b.Box(0.02f, 0.18f, d - 0.06f, k, 0, 0.33f, 0, g);
            var top = b.Group(g, "plateau", 0, h, 0);
            b.Box(w + 0.02f, 0.035f, d + 0.02f, b.M.OakTable, 0, 0.0175f, 0, top);
            var rem = b.Group(top, "télécommande", 0.05f, 0.04f, 0.05f, 23f);
            b.RBox(0.045f, 0.018f, 0.17f, 0.008f, b.M.BlackMatte, 0, 0, 0, rem);
            var arms = new Transform[2];
            for (int i = 0; i < 2; i++)
            {
                var a = b.Group(g, "bras", i == 0 ? -0.35f : 0.35f, h - 0.1f, 0);
                b.Box(0.015f, 0.2f, 0.02f, b.M.Steel, 0, 0, 0, a);
                arms[i] = a;
            }
            var anim = new Toggle(1.0f, t =>
            {
                top.localPosition = new Vector3(0, h + t * 0.17f, -t * 0.12f);
                top.localRotation = Quaternion.Euler(-t * 2.3f, 0, 0);
                foreach (var a in arms)
                {
                    a.localPosition = new Vector3(a.localPosition.x, h - 0.1f + t * 0.1f, -t * 0.06f);
                    a.localRotation = Quaternion.Euler(-t * 28.6f, 0, 0);
                }
            });
            b.Updaters.Add((dt, t) => anim.Update(dt));
            b.Collider(1.75f - w / 2, 1.75f + w / 2, 0, 0.65f, 2.72f - d / 2 - 0.12f, 2.72f + d / 2, root, "collision table basse");
            b.Interactive(g, () => anim.On ? "Abaisser le plateau de la table" : "Relever le plateau de la table", () => { anim.Flip(); b.Sound.Slide(); });
        }

        /* ----------------- Armoire deux portes en chêne clair (photo 2) ----------------- */

        static void Wardrobe(Builder b, Transform root)
        {
            const float z0 = 2.55f, z1 = 3.95f, dpt = 0.6f, hh = 2.42f, th = 0.02f;
            var g = b.Group(root, "armoire");
            var o = b.M.OakLight;
            b.Box(dpt, hh, th, o, dpt / 2, hh / 2, z0 + th / 2, g);
            b.Box(dpt, hh, th, o, dpt / 2, hh / 2, z1 - th / 2, g);
            b.Box(dpt, th, z1 - z0, o, dpt / 2, hh - th / 2, (z0 + z1) / 2, g);
            b.Box(dpt, 0.08f, z1 - z0, o, dpt / 2, 0.04f, (z0 + z1) / 2, g);
            b.Box(th, hh, z1 - z0, o, th / 2, hh / 2, (z0 + z1) / 2, g);
            b.Box(dpt - 0.02f, th, z1 - z0 - 0.04f, o, dpt / 2, 1.95f, (z0 + z1) / 2, g);
            b.Box(dpt - 0.04f, 1.87f, th, o, dpt / 2, 1.015f, 3.25f, g);
            b.Cyl(0.012f, 0.012f, 0.66f, b.M.Steel, dpt / 2, 1.82f, 2.9f, g, 12).transform.localRotation = Quaternion.Euler(90, 0, 0);
            var rnd = new System.Random(8);
            var cloth = new[] { new Color(0.18f, 0.23f, 0.29f), new Color(0.85f, 0.83f, 0.78f), new Color(0.48f, 0.18f, 0.18f), new Color(0.12f, 0.12f, 0.13f), new Color(0.55f, 0.6f, 0.48f) };
            for (int i = 0; i < 6; i++)
                b.Box(0.42f, 0.85f + (float)rnd.NextDouble() * 0.2f, 0.025f, Mat.Lit(cloth[i % cloth.Length], 0.05f), dpt / 2, 1.33f - (float)rnd.NextDouble() * 0.1f, 2.65f + i * 0.09f, g);
            foreach (var y in new[] { 0.5f, 0.95f, 1.4f })
            {
                b.Box(dpt - 0.04f, th, 0.62f, o, dpt / 2, y, 3.6f, g);
                b.Box(0.3f, 0.12f, 0.3f, b.M.Pillow, dpt / 2 - 0.05f, y + 0.07f, 3.6f, g);
            }
            b.Collider(0, dpt + 0.03f, 0, hh, z0, z1, root, "collision armoire");
            float dw = (z1 - z0) / 2 - 0.004f;
            void Door(float hingeZ, int dir)
            {
                var pivot = b.Group(g, "porte armoire", dpt + 0.012f, 0.085f, hingeZ);
                var panel = b.Box(0.022f, hh - 0.09f, dw, o, 0, (hh - 0.09f) / 2, dir * dw / 2, pivot, true, "battant");
                Architecture.MakeKinematic(panel);
                b.Box(0.02f, 0.6f, 0.02f, b.M.Steel, 0.035f, 1.05f, dir * (dw - 0.05f), pivot);
                b.Box(0.03f, 0.02f, 0.015f, b.M.Steel, 0.02f, 1.33f, dir * (dw - 0.05f), pivot);
                b.Box(0.03f, 0.02f, 0.015f, b.M.Steel, 0.02f, 0.77f, dir * (dw - 0.05f), pivot);
                var anim = new Toggle(0.8f, k => pivot.localRotation = Quaternion.Euler(0, dir * k * 90f, 0));
                b.Updaters.Add((dt, t) => anim.Update(dt));
                b.Interactive(pivot, () => anim.On ? "Fermer la porte de l'armoire" : "Ouvrir l'armoire", () => { anim.Flip(); b.Sound.Door(); });
            }
            Door(z0 + 0.003f, 1);
            Door(z1 - 0.003f, -1);
        }

        /* ------------------ Télévision murale sur bras (photos 2 et 3) ------------------ */

        static void Television(Builder b, Transform root)
        {
            const float x = 3.6f, z = 3.65f, y = 1.38f;
            var g = b.Group(root, "télévision", x, 0, z);
            b.Box(0.02f, 0.2f, 0.3f, b.M.BlackMatte, -0.01f, y, 0, g);
            b.Box(0.12f, 0.04f, 0.05f, b.M.BlackMetal, -0.07f, y, 0, g);
            var tv = b.Group(g, "écran", -0.14f, y, 0, -6.9f);
            b.Box(0.045f, 0.66f, 1.14f, b.M.BlackMatte, 0, 0, 0, tv, true);
            // Dalle : la texture est appliquée sur un quad orienté vers l'ouest (vers la pièce)
            var quad = new MeshBuilder();
            var nrm = Vector3.left;
            quad.Quad(new Vector3(0, -0.3125f, -0.555f), new Vector3(0, -0.3125f, 0.555f), new Vector3(0, 0.3125f, 0.555f), new Vector3(0, 0.3125f, -0.555f), nrm);
            var mesh = quad.Build("dalle");
            mesh.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
            b.MeshObj(mesh, b.M.ScreenTv, tv, new Vector3(-0.0235f, 0, 0), false, "dalle");
            var grp = b.NewLightGroup("tv", "Télévision", false).Add(b.M.ScreenTv, Color.white, 1.4f);
            grp.Add(b.PointLight(g, new Vector3(-0.6f, y, 0), new Color(0.62f, 0.7f, 1f), 0.25f, 3f));
            b.Interactive(tv, () => grp.On ? "Éteindre la télévision" : "Allumer la télévision", () => { grp.Toggle(); b.Sound.Beep(); }, 3.2f);
        }

        /* ----------------------- Voilages de la baie vitrée ----------------------- */

        static void Curtains(Builder b, Transform root)
        {
            float x = Room.X1 - 0.1f, top = 2.49f, za = SliderZ0 - 0.35f, zb = SliderZ1 + 0.35f;
            b.Cyl(0.012f, 0.012f, zb - za + 0.1f, b.M.BlackMetal, x, top + 0.005f, (za + zb) / 2, root, 8).transform.localRotation = Quaternion.Euler(90, 0, 0);
            const int seg = 48;
            Action<float> Make(float anchor, int dir, string name)
            {
                var mesh = new Mesh { name = name };
                var go = b.MeshObj(mesh, b.M.Curtain, root, Vector3.zero, true, name);
                var col = go.AddComponent<BoxCollider>();
                col.isTrigger = true;
                return open =>
                {
                    float width = Mathf.Lerp((zb - za) / 2 + 0.04f, 0.36f, open);
                    float amp = Mathf.Lerp(0.025f, 0.07f, open);
                    var pts = new Vector3[seg + 1, 2];
                    for (int i = 0; i <= seg; i++)
                        for (int j = 0; j < 2; j++)
                        {
                            float u = (float)i / seg, yy = j == 0 ? 0.01f : top - 0.01f;
                            float xx = x + Mathf.Sin(u * Mathf.PI * 2 * 9) * amp * (0.6f + 0.4f * Mathf.Sin(yy * 1.3f + 1));
                            pts[i, j] = new Vector3(xx, yy, anchor + dir * u * width);
                        }
                    MeshGen.FillGrid(mesh, pts, Vector3.left, Vector3.zero);
                    var bnd = mesh.bounds;
                    col.center = bnd.center;
                    col.size = bnd.size + new Vector3(0.05f, 0, 0);
                };
            }
            var a = Make(za, 1, "voilage nord");
            var c = Make(zb, -1, "voilage sud");
            var anim = new Toggle(1.6f, k => { a(k); c(k); }, 1);
            b.Updaters.Add((dt, t) => anim.Update(dt));
            foreach (var n in new[] { "voilage nord", "voilage sud" })
            {
                var tr = root.Find(n);
                b.Interactive(tr, () => anim.On ? "Fermer les voilages" : "Ouvrir les voilages", () => { anim.Flip(); b.Sound.Slide(); });
            }
        }

        /* --------------- Kitchenette anthracite, marbre noir (photos 2, 3, 4) --------------- */

        static void Kitchen(Builder b, Transform root)
        {
            var g = b.Group(root, "kitchenette");
            var m = b.M;
            float x0 = Layout.Kitchen.X0, x1 = Layout.Kitchen.X1, zb = Layout.Kitchen.Z1;
            const float front = 4.5f;
            // Photo 4 : réfrigérateur + micro-ondes à droite (ouest), évier au centre, plaque à gauche
            float cab0 = x1 - 0.86f;
            b.Box(0.86f, 0.1f, 0.55f, m.BlackMatte, cab0 + 0.43f, 0.05f, zb - 0.3f, g);
            b.Box(0.86f, 0.76f, 0.58f, m.Anthracite, cab0 + 0.43f, 0.48f, zb - 0.29f, g);
            for (int i = 0; i < 2; i++)
            {
                float cx = cab0 + 0.215f + i * 0.43f;
                b.Box(0.424f, 0.74f, 0.018f, m.Anthracite, cx, 0.48f, front - 0.01f, g);
                float hx = cx + (i == 0 ? 0.17f : -0.17f);
                b.Box(0.012f, 0.28f, 0.012f, m.Steel, hx, 0.66f, front - 0.035f, g);
            }
            b.Box(x1 - x0, 0.04f, zb - front + 0.03f, m.MarbleBlack, (x0 + x1) / 2, 0.88f, (front - 0.03f + zb) / 2, g);
            b.Box(x1 - x0, 0.6f, 0.015f, m.MarbleBlack, (x0 + x1) / 2, 1.2f, zb - 0.0075f, g);
            // Évier noir + robinet noir
            b.Box(0.4f, 0.005f, 0.34f, m.BlackMatte, 2.02f, 0.901f, 4.78f, g);
            b.Cyl(0.018f, 0.022f, 0.32f, m.BlackMatte, 2.02f, 1.06f, 5.02f, g, 16);
            b.Cyl(0.013f, 0.013f, 0.18f, m.BlackMatte, 2.02f, 1.21f, 4.94f, g, 12).transform.localRotation = Quaternion.Euler(90, 0, 0);
            // Plaque de cuisson, bouilloire
            b.RBox(0.29f, 0.035f, 0.36f, 0.01f, m.BlackMetal, 2.33f, 0.917f, 4.76f, g);
            b.Cyl(0.065f, 0.075f, 0.2f, m.Steel, 1.72f, 1.0f, 4.98f, g, 20);
            Fridge(b, g);
            Microwave(b, g);
            // Machine à café à capsules
            var cm = b.Group(g, "machine à café", 1.45f, 1.165f, 4.98f, 23f);
            b.RBox(0.16f, 0.28f, 0.22f, 0.06f, m.BlackMatte, 0, 0.14f, 0, cm);
            b.Cyl(0.07f, 0.07f, 0.03f, m.Anthracite, 0, 0.29f, 0, cm, 20);
            b.Interactive(cm, () => "Préparer un café", () => { b.Sound.Beep(); b.Notify("Café serré en préparation… bonne dégustation !"); });
            // Meubles hauts
            b.Box(x1 - x0, 0.7f, 0.34f, m.Anthracite, (x0 + x1) / 2, 1.85f, zb - 0.17f, g);
            float dw = (x1 - x0) / 3;
            for (int i = 0; i < 3; i++)
            {
                float cx = x0 + dw / 2 + i * dw;
                b.Box(dw - 0.006f, 0.69f, 0.018f, m.Anthracite, cx, 1.85f, zb - 0.349f, g);
                float hx = cx + (i == 2 ? -dw / 2 + 0.06f : dw / 2 - 0.06f);
                b.Box(0.012f, 0.26f, 0.012f, m.Steel, hx, 1.66f, zb - 0.375f, g);
            }
            // Réglette LED et spots
            var under = Mat.Emissive(Color.white, 0f);
            b.Strip(x1 - x0 - 0.1f, 0.008f, 0.02f, (x0 + x1) / 2, 1.495f, zb - 0.28f, g, under);
            var spotMat = Mat.Emissive(Color.white, 0f);
            foreach (var sx in new[] { 1.5f, 2.15f }) b.Cyl(0.035f, 0.035f, 0.01f, spotMat, sx, 2.396f, 4.55f, g, 16);
            var white = new Color(1f, 0.95f, 0.87f);
            var grp = b.NewLightGroup("kitchen", "Éclairage cuisine", false).Add(under, white, 4f).Add(spotMat, white, 5f);
            grp.Add(b.PointLight(g, new Vector3(1.8f, 2.3f, 4.15f), white, 0.9f, 3.5f));
            grp.Add(b.PointLight(g, new Vector3(1.8f, 1.4f, 4.85f), white, 0.4f, 1.5f));
            b.Collider(x0, x1, 0, 0.92f, front - 0.04f, zb, root, "collision cuisine");
        }

        static void Fridge(Builder b, Transform parent)
        {
            var m = b.M;
            float cx = Layout.Kitchen.X0 + 0.255f, w = 0.49f, h = 0.84f, d = 0.55f, z1 = Layout.Kitchen.Z1, z0 = z1 - d;
            const float t = 0.025f;
            var g = b.Group(parent, "réfrigérateur");
            b.Box(t, h, d, m.WhitePlastic, cx - w / 2 + t / 2, h / 2, (z0 + z1) / 2, g);
            b.Box(t, h, d, m.WhitePlastic, cx + w / 2 - t / 2, h / 2, (z0 + z1) / 2, g);
            b.Box(w, t, d, m.WhitePlastic, cx, h - t / 2, (z0 + z1) / 2, g);
            b.Box(w, 0.06f, d, m.WhitePlastic, cx, 0.03f, (z0 + z1) / 2, g);
            b.Box(w, h, t, m.WhitePlastic, cx, h / 2, z1 - t / 2, g);
            var inner = Mat.Emissive(new Color(0.87f, 0.91f, 1f), 0f);
            inner.SetColor(Mat.Urp ? "_BaseColor" : "_Color", new Color(0.96f, 0.97f, 0.98f));
            b.Box(w - 2 * t, h - 0.09f, 0.005f, inner, cx, h / 2, z1 - t - 0.003f, g);
            b.Box(w - 0.06f, 0.008f, d - 0.06f, m.Glass, cx, 0.4f, z0 + d / 2 + 0.02f, g);
            var cols = new[] { new Color(0.82f, 0.23f, 0.17f), new Color(0.95f, 0.9f, 0.77f), new Color(0.23f, 0.48f, 0.23f), Color.white };
            for (int i = 0; i < 4; i++) b.Cyl(0.03f, 0.03f, 0.2f, Mat.Lit(cols[i], 0.6f), cx - 0.15f + i * 0.1f, 0.17f, z0 + 0.3f, g, 12);
            var pivot = b.Group(g, "porte frigo", cx - w / 2, 0.06f, z0 - 0.005f);
            var panel = b.Box(w, h - 0.07f, 0.04f, m.WhitePlastic, w / 2, (h - 0.07f) / 2, -0.02f, pivot, true, "porte");
            Architecture.MakeKinematic(panel);
            b.Box(0.1f, 0.12f, 0.002f, Mat.Lit(new Color(0.18f, 0.45f, 0.71f), 0.4f), 0.15f, 0.6f, -0.041f, pivot);
            b.Box(0.012f, 0.25f, 0.015f, m.Steel, w - 0.04f, 0.45f, -0.05f, pivot);
            var light = b.PointLight(g, new Vector3(cx, h - 0.1f, z0 + 0.2f), new Color(0.91f, 0.94f, 1f), 0.4f, 1.2f);
            light.enabled = false;
            var anim = new Toggle(0.7f, k =>
            {
                pivot.localRotation = Quaternion.Euler(0, k * 99f, 0);
                Mat.SetEmission(inner, new Color(0.87f, 0.91f, 1f), k * 0.8f);
                light.enabled = k > 0.02f;
            });
            b.Updaters.Add((dt, tt) => anim.Update(dt));
            b.Interactive(g, () => anim.On ? "Fermer le réfrigérateur" : "Ouvrir le réfrigérateur", () => { anim.Flip(); b.Sound.Door(); });
        }

        static void Microwave(Builder b, Transform parent)
        {
            var m = b.M;
            var g = b.Group(parent, "micro-ondes", 1.39f, 0.9f, 4.93f);
            b.RBox(0.45f, 0.26f, 0.34f, 0.012f, m.BlackMatte, 0, 0.13f, 0, g);
            var glass = Mat.Emissive(new Color(1f, 0.7f, 0.25f), 0f);
            b.Box(0.3f, 0.18f, 0.005f, glass, -0.06f, 0.13f, -0.171f, g);
            b.Box(0.1f, 0.22f, 0.004f, m.BlackMetal, 0.17f, 0.13f, -0.171f, g);
            b.Box(0.05f, 0.015f, 0.003f, Mat.Emissive(new Color(0.43f, 1f, 0.63f), 0.6f), 0.17f, 0.2f, -0.174f, g);
            float timer = 0;
            b.Updaters.Add((dt, t) =>
            {
                if (timer <= 0) return;
                timer -= dt;
                Mat.SetEmission(glass, new Color(1f, 0.7f, 0.25f), 0.5f);
                if (timer <= 0)
                {
                    Mat.SetEmission(glass, Color.black, 0);
                    b.Sound.Beep();
                    b.Notify("Micro-ondes : ding ! C'est chaud.");
                }
            });
            b.Interactive(g, () => timer > 0 ? "Arrêter le micro-ondes" : "Lancer le micro-ondes (5 s)", () =>
            {
                b.Sound.Beep();
                if (timer > 0) { timer = 0; Mat.SetEmission(glass, Color.black, 0); } else timer = 5;
            });
        }

        /* ------------------------- Salle de bain (photo 5) ------------------------- */

        static void Bathroom(Builder b, Transform root)
        {
            var m = b.M;
            var g = b.Group(root, "salle de bain");
            float ex = Bath.X1;
            b.Box(0.42f, 0.36f, 0.5f, m.Anthracite, ex - 0.21f, 0.62f, 5.0f, g);
            // Vasque (profil de révolution)
            var prof = new[] { new Vector2(0, -0.1f), new Vector2(0.12f, -0.095f), new Vector2(0.18f, -0.055f), new Vector2(0.2f, -0.005f),
                new Vector2(0.215f, 0.006f), new Vector2(0.232f, 0.004f), new Vector2(0.235f, -0.01f), new Vector2(0.22f, -0.08f), new Vector2(0.15f, -0.14f), new Vector2(0, -0.145f) };
            var bowl = b.MeshObj(MeshGen.Lathe(prof, 48, Vector3.zero), m.Ceramic, g, new Vector3(ex - 0.25f, 0.94f, 5.0f), true, "vasque");
            bowl.transform.localScale = new Vector3(0.95f, 1, 1.15f);
            b.Cyl(0.015f, 0.02f, 0.14f, m.Chrome, ex - 0.07f, 1.01f, 5.0f, g, 16);
            b.Cyl(0.01f, 0.01f, 0.12f, m.Chrome, ex - 0.12f, 1.07f, 5.0f, g, 12).transform.localRotation = Quaternion.Euler(0, 0, 90);
            b.Cyl(0.03f, 0.032f, 0.14f, m.BlackMatte, ex - 0.1f, 1.02f, 4.8f, g, 16);
            b.Collider(ex - 0.45f, ex, 0.4f, 1.0f, 4.7f, 5.3f, g, "collision vasque");
            // Miroir festonné rétroéclairé (12 lobes)
            Vector2[] Scallop(float R)
            {
                var pts = new Vector2[240];
                for (int i = 0; i < 240; i++)
                {
                    float a = i * Mathf.PI * 2 / 240, r = R * (1 + 0.055f * Mathf.Cos(a * 12));
                    pts[i] = new Vector2(Mathf.Cos(a) * r, Mathf.Sin(a) * r);
                }
                return pts;
            }
            const float my = 1.62f, mz = 5.0f;
            var ledCol = new Color(0.95f, 0.97f, 1f);
            var ledMat = Mat.Emissive(ledCol, 0f);
            var glow = b.MeshObj(MeshGen.Polygon(Scallop(0.4f)), ledMat, g, new Vector3(ex - 0.004f, my, mz), false, "halo miroir");
            glow.transform.localRotation = Quaternion.Euler(0, -90, 0);
            var mirror = b.MeshObj(MeshGen.Polygon(Scallop(0.36f)), m.Mirror, g, new Vector3(ex - 0.03f, my, mz), false, "miroir");
            mirror.transform.localRotation = Quaternion.Euler(0, -90, 0);
            b.Cyl(0.34f, 0.34f, 0.025f, m.BlackMatte, ex - 0.015f, my, mz, g, 48).transform.localRotation = Quaternion.Euler(0, 0, 90);
            // WC (orienté vers le nord)
            var wc = b.Group(g, "wc", 4.3f, 0, Bath.Z1, 180);
            b.RBox(0.38f, 0.4f, 0.17f, 0.03f, m.Ceramic, 0, 0.62f, 0.1f, wc);
            b.Cyl(0.13f, 0.15f, 0.36f, m.Ceramic, 0, 0.18f, 0.4f, wc, 24);
            var bowlWc = b.Cyl(0.19f, 0.15f, 0.06f, m.Ceramic, 0, 0.39f, 0.42f, wc, 32);
            bowlWc.transform.localScale = new Vector3(1, 1, 1.25f);
            var seat = b.MeshObj(MeshGen.Torus(0.16f, 0.025f, 32, 10, Vector3.zero), m.Ceramic, wc, new Vector3(0, 0.43f, 0.42f), true, "abattant");
            seat.transform.localScale = new Vector3(1, 1, 1.25f);
            b.RBox(0.36f, 0.43f, 0.025f, 0.01f, m.Ceramic, 0, 0.62f, 0.21f, wc).transform.localRotation = Quaternion.Euler(-7, 0, 0);
            b.ColliderAround(wc);
            b.Interactive(wc, () => "Tirer la chasse", () => { b.Sound.Door(); b.Notify("Chasse d'eau tirée."); });
            b.Cyl(0.11f, 0.1f, 0.27f, m.Anthracite, 4.75f, 0.135f, 6.35f, g, 20);
            b.Box(0.75f, 0.012f, 0.45f, m.Doormat, 3.4f, 0.018f, 5.2f, g);
            Shower(b, g);
            // Éclairage
            var spots = Mat.Emissive(Color.white, 0f);
            foreach (var p in new[] { new Vector2(3.4f, 5.1f), new Vector2(4.3f, 5.6f), new Vector2(3.3f, 6.1f) })
                b.Cyl(0.04f, 0.04f, 0.01f, spots, p.x, H - 0.004f, p.y, g, 16);
            var cool = new Color(0.96f, 0.97f, 1f);
            var grp = b.NewLightGroup("bath", "Salle de bain", false).Add(spots, cool, 5f).Add(ledMat, ledCol, 5f);
            grp.Add(b.PointLight(g, new Vector3(3.75f, 2.4f, 5.55f), cool, 1.6f, 4.5f, true));
            grp.Add(b.PointLight(g, new Vector3(ex - 0.4f, my, mz), cool, 0.4f, 1.6f));
        }

        static void Shower(Builder b, Transform g)
        {
            var m = b.M;
            float x0 = Bath.X0, x1 = 3.95f, z0 = 5.56f, z1 = Bath.Z1, hh = 1.98f;
            b.Slab(x0, x1, 0.012f, 0.04f, z0, z1, m.Ceramic, g, true, false, "receveur");
            b.Box(0.68f, hh - 0.06f, 0.008f, m.GlassShower, x0 + 0.34f, 0.04f + (hh - 0.06f) / 2, z0, g, true, "paroi");
            b.Box(0.008f, hh - 0.06f, z1 - z0, m.GlassShower, x1, 0.04f + (hh - 0.06f) / 2, (z0 + z1) / 2, g, true, "paroi");
            b.Box(x1 - x0, 0.025f, 0.025f, m.BlackMetal, (x0 + x1) / 2, hh, z0, g);
            b.Box(0.025f, 0.025f, z1 - z0, m.BlackMetal, x1, hh, (z0 + z1) / 2, g);
            b.Box(0.025f, hh, 0.025f, m.BlackMetal, x1, hh / 2, z0, g);
            var door = b.Group(g, "porte douche", x0 + 0.66f, 0, z0 + 0.04f);
            var glass = b.Box(0.66f, hh - 0.08f, 0.008f, m.GlassShower, 0.33f, 0.04f + (hh - 0.08f) / 2, 0, door, true, "vitre");
            Architecture.MakeKinematic(glass);
            b.Box(0.02f, hh - 0.08f, 0.02f, m.BlackMetal, 0.65f, 0.04f + (hh - 0.08f) / 2, 0, door);
            var anim = new Toggle(0.9f, k => door.localPosition = new Vector3(x0 + 0.66f - k * 0.58f, 0, z0 + 0.04f));
            b.Updaters.Add((dt, t) => anim.Update(dt));
            b.Interactive(door, () => anim.On ? "Fermer la porte de douche" : "Ouvrir la porte de douche", () => { anim.Flip(); b.Sound.Slide(); });
            // Colonne de douche noire
            float sx = 3.35f, sz = z1 - 0.03f;
            b.Box(0.022f, 1.15f, 0.022f, m.BlackMatte, sx, 1.45f, sz, g);
            b.Box(0.022f, 0.022f, 0.3f, m.BlackMatte, sx, 2.02f, sz - 0.15f, g);
            b.Box(0.25f, 0.012f, 0.25f, m.BlackMatte, sx, 2.0f, sz - 0.3f, g);
            b.Box(0.14f, 0.06f, 0.05f, m.BlackMatte, sx, 1.1f, sz - 0.02f, g);
            var bottles = new[] { new Color(0.1f, 0.31f, 0.61f), new Color(0.16f, 0.55f, 0.82f), new Color(0.86f, 0.86f, 0.86f), new Color(0.06f, 0.23f, 0.17f) };
            for (int i = 0; i < 4; i++) b.Cyl(0.03f, 0.03f, 0.2f + (i % 2) * 0.04f, Mat.Lit(bottles[i], 0.7f), x1 - 0.12f - i * 0.07f, 0.15f, z1 - 0.06f, g, 12);
            // Eau de la douche (particules)
            var waterGo = new GameObject("eau douche");
            waterGo.transform.SetParent(g, false);
            waterGo.transform.localPosition = new Vector3(sx, 1.98f, sz - 0.3f);
            var ps = Effects.Rain(waterGo);
            var head = b.Group(g, "commande douche", sx, 1.6f, sz - 0.2f);
            var hc = head.gameObject.AddComponent<BoxCollider>();
            hc.size = new Vector3(0.3f, 0.4f, 0.3f);
            hc.isTrigger = true;
            b.Interactive(head, () => ps.isPlaying ? "Couper la douche" : "Ouvrir l'eau de la douche", () =>
            {
                if (ps.isPlaying) ps.Stop(); else ps.Play();
                b.Sound.Slide();
            });
        }

        /* ------------------------------- Entrée ------------------------------- */

        static void Hall(Builder b, Transform root)
        {
            var g = b.Group(root, "entrée");
            b.Box(0.02f, 0.06f, 0.6f, b.M.OakDoor, 0.01f, 1.7f, 5.5f, g);
            for (int i = 0; i < 4; i++) b.Cyl(0.008f, 0.008f, 0.06f, b.M.BlackMetal, 0.04f, 1.68f, 5.27f + i * 0.15f, g, 8).transform.localRotation = Quaternion.Euler(0, 0, 90);
            b.Box(0.3f, 0.4f, 0.7f, b.M.OakLight, 0.15f, 0.2f, 5.6f, g, true, "meuble à chaussures");
            b.Box(0.7f, 0.012f, 0.45f, b.M.Doormat, 0.52f, 0.006f, Layout.Hall.Z1 - 0.3f, g);
        }

        /* ----------------------------- Interrupteurs ----------------------------- */

        static void SwitchPlate(Builder b, Transform root, float x, float y, float z, float ryDeg, LightGroup grp, string label)
        {
            var g = b.Group(root, "interrupteur", x, y, z, ryDeg);
            b.Box(0.085f, 0.085f, 0.01f, b.M.WhitePlastic, 0, 0, 0.005f, g);
            var rocker = b.Box(0.055f, 0.055f, 0.008f, b.M.WhitePlastic, 0, 0, 0.012f, g);
            void Sync() { rocker.transform.localRotation = Quaternion.Euler(grp.On ? -7 : 7, 0, 0); }
            Sync();
            grp.Changed += _ => Sync();
            var c = g.gameObject.AddComponent<BoxCollider>();
            c.center = new Vector3(0, 0, 0.02f);
            c.size = new Vector3(0.12f, 0.12f, 0.06f);
            c.isTrigger = true;
            b.Interactive(g, () => (grp.On ? "Éteindre : " : "Allumer : ") + label, () => { grp.Toggle(); b.Sound.Click(); b.DirtyReflections(); }, 2.6f);
        }

        public static void Switch(Builder b, Transform root, float x, float y, float z, float ryDeg, LightGroup grp, string label)
        {
            SwitchPlate(b, root, x, y, z, ryDeg, grp, label);
        }

        static void Switches(Builder b, Transform root)
        {
            var L = b.Lights;
            SwitchPlate(b, root, 0.001f, 1.1f, 4.08f, 90, L["ceiling"], "plafonnier");
            SwitchPlate(b, root, 0.001f, 1.1f, 4.2f, 90, L["led"], "rubans LED du plafond");
            SwitchPlate(b, root, 0.62f, 0.86f, 0.031f, 0, L["headboard"], "LED de la tête de lit");
            SwitchPlate(b, root, 2.78f, 0.86f, 0.031f, 0, L["headboard"], "LED de la tête de lit");
            SwitchPlate(b, root, 1.06f, 1.2f, Layout.Hall.Z0 - 0.001f, 180, L["kitchen"], "éclairage de la cuisine");
            SwitchPlate(b, root, 3.535f, 1.1f, 4.399f, 180, L["bath"], "salle de bain");
        }
    }
}

using UnityEngine;
using static Appartement.Layout;

namespace Appartement
{
    /// <summary>Sols, murs, plafonds (caisson + gorge LED), plinthes, portes et baie vitrée.</summary>
    public static class Architecture
    {
        static Material[] Faces(Material px, Material nx, Material py, Material ny, Material pz, Material nz)
        {
            return new[] { px, nx, py, ny, pz, nz };
        }

        public static void Build(Builder b)
        {
            var m = b.M;
            var arch = b.Group(b.Root, "Architecture");

            // Sols
            b.Slab(Room.X0, Room.X1, -0.1f, 0, Room.Z0, Room.Z1, m.FloorWood, arch, true, false, "sol séjour");
            b.Slab(Hall.X0, Hall.X1 + T, -0.1f, 0, Hall.Z0, Hall.Z1, m.FloorWood, arch, true, false, "sol entrée");
            b.Slab(Kitchen.X0, Kitchen.X1, -0.1f, 0, Kitchen.Z0, Kitchen.Z1, m.MarbleFloor, arch, true, false);
            b.Slab(Kitchen.X0, Kitchen.X1, 0, 0.025f, 3.85f, Kitchen.Z1, m.MarbleFloor, arch, true, false, "estrade cuisine");
            b.Slab(BathDoorX0, BathDoorX1, -0.1f, 0.012f, 4.4f, Bath.Z0, m.MarbleFloor, arch, true, false);
            b.Slab(Bath.X0, Bath.X1, -0.1f, 0.012f, Bath.Z0, Bath.Z1, m.MarbleFloor, arch, true, false, "sol sdb");
            b.Slab(Room.X1, Room.X1 + T, -0.1f, 0.018f, SliderZ0, SliderZ1, m.BlackMetal, arch, true, false, "seuil");

            // Murs
            Material paint = m.Wall, ext = m.Plaster, marble = m.MarbleWall;
            b.Slab(-T, Room.X1, 0, H, -T, 0, paint, arch, true, true, "mur nord");
            b.Slab(-T, 0, 0, H, -T, Hall.Z1 + T, paint, arch, true, true, "mur ouest");
            var east = Faces(ext, paint, ext, paint, ext, ext);
            b.Slab(Room.X1, Room.X1 + T, 0, ExtTop, Garden.Z0 - 0.2f, SliderZ0, east, arch, true, true, "façade");
            b.Slab(Room.X1, Room.X1 + T, 0, ExtTop, SliderZ1, Room.Z1 + T, east, arch, true, true, "façade");
            b.Slab(Room.X1, Room.X1 + T, SliderH, ExtTop, SliderZ0, SliderZ1, east, arch, true, true, "linteau baie");
            var bathN = Faces(paint, paint, paint, paint, marble, paint);
            var bathNExt = Faces(ext, ext, ext, ext, marble, ext);
            b.Slab(Kitchen.X1, BathDoorX0, 0, H, 4.4f, Bath.Z0, bathN, arch);
            b.Slab(BathDoorX1, Room.X1 + T, 0, H, 4.4f, Bath.Z0, bathN, arch);
            b.Slab(BathDoorX0, BathDoorX1, BathDoorH, H, 4.4f, Bath.Z0, bathN, arch);
            b.Slab(Room.X1 + T, Bath.X1 + T, 0, ExtTop, 4.4f, Bath.Z0, bathNExt, arch);
            b.Slab(Kitchen.X1, Bath.X0, 0, H, Bath.Z0, Bath.Z1 + T, Faces(marble, paint, paint, paint, paint, paint), arch);
            b.Slab(Bath.X1, Bath.X1 + T, 0, ExtTop, 4.4f, Bath.Z1 + T, Faces(ext, marble, ext, ext, ext, ext), arch);
            b.Slab(Kitchen.X1, Bath.X1, 0, H, Bath.Z1, Bath.Z1 + T, Faces(paint, paint, paint, paint, paint, marble), arch);
            b.Slab(Kitchen.X0, Kitchen.X1, 0, H, Kitchen.Z1, Kitchen.Z1 + T, paint, arch);
            b.Slab(Hall.X1, Hall.X1 + T, 0, H, Hall.Z0, Hall.Z1, paint, arch, true, true, "cloison entrée");
            b.Slab(Hall.X1 + T, Kitchen.X1, 0, H, Kitchen.Z1 + T, Bath.Z1 + T, paint, arch);
            b.Slab(-T, 0.1f, 0, H, Hall.Z1, Hall.Z1 + T, paint, arch);
            b.Slab(0.95f, Hall.X1 + T, 0, H, Hall.Z1, Hall.Z1 + T, paint, arch);
            b.Slab(0.1f, 0.95f, 2.1f, H, Hall.Z1, Hall.Z1 + T, paint, arch);

            // Plafonds / toiture
            var roof = Faces(ext, ext, ext, m.Ceiling, ext, ext);
            b.Slab(-T, Room.X1 + T, H, ExtTop, -T, Bath.Z1 + T, roof, arch, false, true, "plafond");
            b.Slab(Room.X1 + T, Bath.X1 + T, H, ExtTop, 4.4f, Bath.Z1 + T, roof, arch, false, true, "plafond sdb");

            // Plafond à caisson du séjour avec gorge lumineuse (photos 1 et 2)
            const float band = 0.4f, by = 2.5f;
            var ceil = m.Ceiling;
            b.Slab(Room.X0, Room.X1, by, H, Room.Z0, Room.Z0 + band, ceil, arch, false);
            b.Slab(Room.X0, Room.X1, by, H, Room.Z1 - band, Room.Z1, ceil, arch, false);
            b.Slab(Room.X0, Room.X0 + band, by, H, Room.Z0 + band, Room.Z1 - band, ceil, arch, false);
            b.Slab(Room.X1 - band, Room.X1, by, H, Room.Z0 + band, Room.Z1 - band, ceil, arch, false);
            var ledCol = new Color(1f, 0.77f, 0.54f);
            var cove = Mat.Emissive(ledCol, 4f);
            float ix0 = Room.X0 + band, ix1 = Room.X1 - band, iz0 = Room.Z0 + band, iz1 = Room.Z1 - band, ly = H - 0.035f;
            b.Strip(ix1 - ix0, 0.02f, 0.012f, (ix0 + ix1) / 2, ly, iz0 + 0.01f, arch, cove);
            b.Strip(ix1 - ix0, 0.02f, 0.012f, (ix0 + ix1) / 2, ly, iz1 - 0.01f, arch, cove);
            b.Strip(0.012f, 0.02f, iz1 - iz0, ix0 + 0.01f, ly, (iz0 + iz1) / 2, arch, cove);
            b.Strip(0.012f, 0.02f, iz1 - iz0, ix1 - 0.01f, ly, (iz0 + iz1) / 2, arch, cove);
            var led = b.NewLightGroup("led", "Rubans LED du plafond", true).Add(cove, ledCol, 4f);
            foreach (var z in new[] { 0.9f, 2.2f, 3.5f })
                led.Add(b.PointLight(arch, new Vector3(1.8f, 2.6f, z), new Color(1f, 0.78f, 0.55f), 0.35f, 3.2f));

            // Faux plafond de la kitchenette
            b.Slab(Kitchen.X0, Kitchen.X1, 2.4f, H, 4.2f, Kitchen.Z1, ceil, arch, false);

            // Plinthes
            void Plinth(float x0, float x1, float z0, float z1) { b.Slab(x0, x1, 0, 0.07f, z0, z1, m.Baseboard, arch, false, false, "plinthe"); }
            const float bd = 0.012f;
            Plinth(0, 0.55f, 0, bd); Plinth(2.85f, Room.X1, 0, bd);
            Plinth(0, bd, 0, 2.55f); Plinth(0, bd, 3.95f, Hall.Z1);
            Plinth(Room.X1 - bd, Room.X1, 0, SliderZ0); Plinth(Room.X1 - bd, Room.X1, SliderZ1, Room.Z1);
            Plinth(BathDoorX1, Room.X1, Room.Z1 - bd, Room.Z1); Plinth(Kitchen.X1, BathDoorX0, Room.Z1 - bd, Room.Z1);
            Plinth(Hall.X1 - bd, Hall.X1, Hall.Z0, Hall.Z1);

            BathDoor(b, arch);
            FrontDoor(b, arch);
            SlidingDoor(b, arch);
        }

        static void Casing(Builder b, Transform parent, float x0, float x1, float h, float zFace, float dir)
        {
            const float w = 0.06f, d = 0.015f;
            float z = zFace + dir * d / 2;
            b.Box(w, h + w, d, b.M.OakDoor, x0 - w / 2, (h + w) / 2, z, parent);
            b.Box(w, h + w, d, b.M.OakDoor, x1 + w / 2, (h + w) / 2, z, parent);
            b.Box(x1 - x0 + 2 * w, w, d, b.M.OakDoor, (x0 + x1) / 2, h + w / 2, z, parent);
        }

        static void Lever(Builder b, Transform parent, float x, float y, float z, float side)
        {
            var g = b.Group(parent, "poignée", x, y, z);
            b.Box(0.05f, 0.05f, 0.012f, b.M.BlackMetal, 0, 0, side * 0.006f, g);
            b.Box(0.13f, 0.018f, 0.018f, b.M.BlackMetal, -0.05f, 0, side * 0.04f, g);
            b.Box(0.018f, 0.018f, 0.04f, b.M.BlackMetal, 0, 0, side * 0.025f, g);
        }

        /// <summary>Porte battante de la salle de bain (chêne clair, poignée noire).</summary>
        static void BathDoor(Builder b, Transform parent)
        {
            float w = BathDoorX1 - BathDoorX0 - 0.01f, h = BathDoorH - 0.01f, th = 0.04f;
            Casing(b, parent, BathDoorX0, BathDoorX1, BathDoorH, 4.4f, -1);
            Casing(b, parent, BathDoorX0, BathDoorX1, BathDoorH, Bath.Z0, 1);
            var pivot = b.Group(parent, "porte sdb", BathDoorX0 + 0.005f, 0, 4.46f);
            var panel = b.Box(w, h, th, b.M.OakDoor, w / 2, h / 2 + 0.005f, 0, pivot, true, "battant");
            Lever(b, pivot, w - 0.07f, 1.0f, -th / 2, -1);
            Lever(b, pivot, w - 0.07f, 1.0f, th / 2, 1);
            MakeKinematic(panel);
            var anim = new Toggle(0.9f, k => pivot.localRotation = Quaternion.Euler(0, -k * 93.6f, 0));
            b.Updaters.Add((dt, t) => anim.Update(dt));
            b.Interactive(pivot, () => anim.On ? "Fermer la porte de la salle de bain" : "Ouvrir la porte de la salle de bain",
                () => { anim.Flip(); b.Sound.Door(); });
        }

        /// <summary>Porte palière (verrouillée : l'immeuble n'est pas modélisé).</summary>
        static void FrontDoor(Builder b, Transform parent)
        {
            float z = Hall.Z1 + 0.05f;
            Casing(b, parent, 0.1f, 0.95f, 2.1f, Hall.Z1, -1);
            var door = b.Group(parent, "porte d'entrée");
            b.Box(0.84f, 2.09f, 0.05f, b.M.OakDoor, 0.525f, 1.045f, z, door, true);
            b.Box(0.7f, 0.012f, 0.01f, b.M.BlackMatte, 0.525f, 1.6f, z - 0.03f, door);
            b.Box(0.7f, 0.012f, 0.01f, b.M.BlackMatte, 0.525f, 0.5f, z - 0.03f, door);
            Lever(b, door, 0.88f, 1.02f, z - 0.025f, -1);
            b.Interactive(door, () => "Porte d'entrée", () =>
            {
                b.Sound.Click();
                b.Notify("La porte d'entrée est verrouillée — la visite se poursuit dans l'appartement et le jardin.");
            });
        }

        /// <summary>Baie vitrée coulissante, menuiserie aluminium noir (photos 1 et 3).</summary>
        static void SlidingDoor(Builder b, Transform parent)
        {
            var m = b.M;
            var g = b.Group(parent, "baie vitrée");
            float x = Room.X1, f = 0.05f, len = SliderZ1 - SliderZ0;
            b.Slab(x, x + T, SliderH - f, SliderH, SliderZ0, SliderZ1, m.BlackMetal, g, false);
            b.Slab(x, x + T, 0, SliderH, SliderZ0, SliderZ0 + f, m.BlackMetal, g, false);
            b.Slab(x, x + T, 0, SliderH, SliderZ1 - f, SliderZ1, m.BlackMetal, g, false);
            float panelW = len / 2 + 0.03f, ph = SliderH - f - 0.02f;
            Transform Panel(float px, float z0, string name)
            {
                var p = b.Group(g, name, px, 0.02f, z0);
                const float pf = 0.055f;
                b.Box(0.04f, pf, panelW, m.BlackMetal, 0, pf / 2, panelW / 2, p);
                b.Box(0.04f, pf, panelW, m.BlackMetal, 0, ph - pf / 2, panelW / 2, p);
                b.Box(0.04f, ph, pf, m.BlackMetal, 0, ph / 2, pf / 2, p);
                b.Box(0.04f, ph, pf, m.BlackMetal, 0, ph / 2, panelW - pf / 2, p);
                var glass = b.Box(0.008f, ph - 2 * pf, panelW - 2 * pf, m.Glass, 0, ph / 2, panelW / 2, p);
                glass.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                var c = p.gameObject.AddComponent<BoxCollider>();
                c.center = new Vector3(0, ph / 2, panelW / 2);
                c.size = new Vector3(0.05f, ph, panelW);
                return p;
            }
            var fixedP = Panel(x + 0.085f, SliderZ1 - f - panelW, "vantail fixe");
            var moving = Panel(x + 0.035f, SliderZ0 + f, "vantail mobile");
            b.Box(0.012f, 0.012f, 0.16f, m.BlackMetal, -0.03f, 1.05f, 0.08f, moving);
            MakeKinematic(moving.gameObject);
            float z0 = moving.localPosition.z, travel = panelW - 0.09f;
            var anim = new Toggle(1.1f, k => { var p = moving.localPosition; p.z = z0 + k * travel; moving.localPosition = p; });
            b.Updaters.Add((dt, t) => anim.Update(dt));
            System.Func<string> label = () => anim.On ? "Fermer la baie vitrée" : "Ouvrir la baie vitrée (accès au jardin)";
            System.Action act = () => { anim.Flip(); b.Sound.Slide(); };
            b.Interactive(moving, label, act);
            b.Interactive(fixedP, label, act);
            // Coffre et coulisses du volet roulant
            b.Slab(x + T, x + T + 0.2f, SliderH, SliderH + 0.3f, SliderZ0 - 0.1f, SliderZ1 + 0.1f, m.Anthracite, g, false);
            b.Slab(x + T, x + T + 0.04f, 0, SliderH, SliderZ0 - 0.06f, SliderZ0 - 0.02f, m.Anthracite, g, false);
            b.Slab(x + T, x + T + 0.04f, 0, SliderH, SliderZ1 + 0.02f, SliderZ1 + 0.06f, m.Anthracite, g, false);
        }

        /// <summary>Un objet déplacé par script porte un Rigidbody cinématique (collisions à jour, sans coût).</summary>
        public static void MakeKinematic(GameObject go)
        {
            var rb = go.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
        }
    }
}

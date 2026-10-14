using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Plan de l'appartement en mètres, dans le repère du plan :
    /// X = est, Y = haut, Z = sud (le mur de la tête de lit est au nord, z = 0).
    /// Tout le décor est construit sous une racine retournée en Z (scale 1, 1, -1) : ces cotes
    /// s'utilisent telles quelles et la scène Unity n'est pas inversée (le nord est vers +Z monde).
    /// Les collisions sont recopiées dans le repère monde par <see cref="MirroredColliders"/>.
    /// Les dimensions sont estimées d'après les photos, pas mesurées.
    /// </summary>
    public static class Layout
    {
        public const float H = 2.7f;   // hauteur sous plafond
        public const float T = 0.12f;  // épaisseur des cloisons
        public const float ExtTop = 3.05f;

        public static readonly Rect2 Room = new Rect2(0f, 3.6f, 0f, 4.4f);
        public const float SliderZ0 = 0.55f, SliderZ1 = 2.55f, SliderH = 2.25f;
        public static readonly Rect2 Kitchen = new Rect2(1.12f, 2.5f, 4.4f, 5.1f);
        public static readonly Rect2 Hall = new Rect2(0f, 1.0f, 4.4f, 6.2f);
        public static readonly Rect2 Bath = new Rect2(2.62f, 4.9f, 4.52f, 6.6f);
        public const float BathDoorX0 = 2.72f, BathDoorX1 = 3.47f, BathDoorH = 2.08f;
        public static readonly Rect2 Garden = new Rect2(3.72f, 10.2f, -1.4f, 4.4f);
        public const float JacuzziX = 9.05f, JacuzziZ = -0.2f, JacuzziR = 0.95f;

        /// <summary>Point de départ (repère du plan) et cap (radians, 0 = regard vers le nord).</summary>
        public static readonly Vector3 Spawn = new Vector3(1.9f, 0f, 3.75f);
        public const float SpawnYaw = 0f;

        public struct Zone
        {
            public string Name; public Rect2 Area; public bool Outdoor;
            public Zone(string n, Rect2 a, bool o = false) { Name = n; Area = a; Outdoor = o; }
        }

        /// <summary>Zones nommées, testées dans l'ordre.</summary>
        public static readonly Zone[] Zones =
        {
            new Zone("Salle de bain", new Rect2(Bath.X0, Bath.X1, Bath.Z0 - 0.06f, Bath.Z1)),
            new Zone("Entrée", new Rect2(Hall.X0, Hall.X1, Hall.Z0 + 0.15f, Hall.Z1)),
            new Zone("Kitchenette", new Rect2(Kitchen.X0, Kitchen.X1, 4.05f, Kitchen.Z1)),
            new Zone("Chambre · Séjour", new Rect2(Room.X0, Room.X1 + 0.12f, Room.Z0, Room.Z1)),
            new Zone("Spa", new Rect2(7.6f, Garden.X1, Garden.Z0, 1.3f), true),
            new Zone("Terrasse", new Rect2(Garden.X0, 7.0f, Garden.Z0, Garden.Z1), true),
            new Zone("Jardin", new Rect2(Garden.X0, Garden.X1, Garden.Z0, Garden.Z1), true),
        };

        public static bool ZoneAt(float x, float z, out Zone zone)
        {
            foreach (var zn in Zones)
                if (zn.Area.Contains(x, z)) { zone = zn; return true; }
            zone = default(Zone);
            return false;
        }

        /// <summary>Conversion repère du plan → monde Unity (miroir sur Z).</summary>
        public static Vector3 ToWorld(Vector3 plan) { return new Vector3(plan.x, plan.y, -plan.z); }
        public static Vector3 ToPlan(Vector3 world) { return new Vector3(world.x, world.y, -world.z); }
    }

    public struct Rect2
    {
        public float X0, X1, Z0, Z1;
        public Rect2(float x0, float x1, float z0, float z1) { X0 = x0; X1 = x1; Z0 = z0; Z1 = z1; }
        public bool Contains(float x, float z) { return x >= X0 && x <= X1 && z >= Z0 && z <= Z1; }
    }
}

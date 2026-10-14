using System;
using System.Collections.Generic;
using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Outils de modélisation. Coordonnées en mètres dans le repère du plan
    /// (X = est, Y = haut, Z = sud) : tous les objets sont enfants de la racine miroir.
    /// </summary>
    public class Builder
    {
        public readonly Materials M;
        public readonly Transform Root;
        public readonly List<Action<float, float>> Updaters = new List<Action<float, float>>();
        public readonly Dictionary<string, LightGroup> Lights = new Dictionary<string, LightGroup>();
        public readonly HashSet<Renderer> Outdoor = new HashSet<Renderer>();
        public Action<string> Notify = s => { };
        public SoundFx Sound;
        public Action DirtyReflections = () => { };

        public Builder(Materials m, Transform root) { M = m; Root = root; }

        static GameObject Make(string name, Transform parent, Mesh mesh, Material[] mats, bool cast)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterials = mats;
            r.shadowCastingMode = cast ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = true;
            return go;
        }

        /// <summary>Boîte définie par ses bornes (repère du plan). Collision optionnelle.</summary>
        public GameObject Slab(float x0, float x1, float y0, float y1, float z0, float z1, Material mat, Transform parent = null, bool collide = true, bool cast = true, string name = "dalle")
        {
            return Slab(x0, x1, y0, y1, z0, z1, new[] { mat }, parent, collide, cast, name);
        }

        /// <summary>Variante à six matériaux, un par face : +x, -x, +y, -y, +z, -z.</summary>
        public GameObject Slab(float x0, float x1, float y0, float y1, float z0, float z1, Material[] mats, Transform parent = null, bool collide = true, bool cast = true, string name = "dalle")
        {
            var center = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            var size = new Vector3(x1 - x0, y1 - y0, z1 - z0);
            var mesh = MeshGen.Box(size, center, mats.Length == 6);
            var go = Make(name, parent ?? Root, mesh, mats, cast);
            go.transform.localPosition = center;
            if (collide) go.AddComponent<BoxCollider>();
            go.isStatic = true;
            return go;
        }

        /// <summary>Boîte centrée en (x, y, z) dans le repère local du parent.</summary>
        public GameObject Box(float w, float h, float d, Material mat, float x, float y, float z, Transform parent, bool collide = false, string name = "boîte")
        {
            var p = new Vector3(x, y, z);
            var go = Make(name, parent, MeshGen.Box(new Vector3(w, h, d), p), new[] { mat }, true);
            go.transform.localPosition = p;
            if (collide) go.AddComponent<BoxCollider>();
            return go;
        }

        public GameObject RBox(float w, float h, float d, float r, Material mat, float x, float y, float z, Transform parent, int seg = 3, string name = "arrondi")
        {
            var p = new Vector3(x, y, z);
            var go = Make(name, parent, MeshGen.RoundedBox(new Vector3(w, h, d), r, seg, p), new[] { mat }, true);
            go.transform.localPosition = p;
            return go;
        }

        public GameObject Cyl(float rt, float rb, float h, Material mat, float x, float y, float z, Transform parent, int seg = 24, bool caps = true, string name = "cylindre")
        {
            var p = new Vector3(x, y, z);
            var go = Make(name, parent, MeshGen.Cylinder(rt, rb, h, seg, caps, p), new[] { mat }, true);
            go.transform.localPosition = p;
            return go;
        }

        public GameObject MeshObj(Mesh mesh, Material mat, Transform parent, Vector3 pos, bool cast = true, string name = "objet")
        {
            var go = Make(name, parent, mesh, new[] { mat }, cast);
            go.transform.localPosition = pos;
            return go;
        }

        /// <summary>Bande lumineuse (ruban LED), sans ombre ni collision.</summary>
        public GameObject Strip(float w, float h, float d, float x, float y, float z, Transform parent, Material mat)
        {
            var go = Box(w, h, d, mat, x, y, z, parent, false, "LED");
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        public Transform Group(Transform parent, string name, float x = 0, float y = 0, float z = 0, float ryDeg = 0)
        {
            var g = new GameObject(name).transform;
            g.SetParent(parent ?? Root, false);
            g.localPosition = new Vector3(x, y, z);
            g.localRotation = Quaternion.Euler(0, ryDeg, 0);
            return g;
        }

        /// <summary>Collision seule (boîte invisible), en coordonnées du plan.</summary>
        public BoxCollider Collider(float x0, float x1, float y0, float y1, float z0, float z1, Transform parent = null, string name = "collision")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent ?? Root, false);
            go.transform.localPosition = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            // Calque « Ignore Raycast » : bloque le joueur mais pas le réticule d'interaction.
            go.layer = 2;
            var c = go.AddComponent<BoxCollider>();
            c.size = new Vector3(x1 - x0, y1 - y0, z1 - z0);
            return c;
        }

        /// <summary>Ajoute une boîte de collision englobant tous les rendus d'un objet (en local au parent de l'objet).</summary>
        public BoxCollider ColliderAround(Transform obj, float yMin = float.NaN)
        {
            var renderers = obj.GetComponentsInChildren<MeshRenderer>();
            if (renderers.Length == 0) return null;
            var b = new Bounds();
            bool first = true;
            foreach (var r in renderers)
            {
                var mf = r.GetComponent<MeshFilter>();
                if (mf == null || mf.sharedMesh == null) continue;
                var mb = mf.sharedMesh.bounds;
                var m = obj.worldToLocalMatrix * r.transform.localToWorldMatrix;
                for (int i = 0; i < 8; i++)
                {
                    var corner = mb.center + Vector3.Scale(mb.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                    var p = m.MultiplyPoint3x4(corner);
                    if (first) { b = new Bounds(p, Vector3.zero); first = false; } else b.Encapsulate(p);
                }
            }
            var host = new GameObject("collision");
            host.transform.SetParent(obj, false);
            host.layer = 2;
            var c = host.AddComponent<BoxCollider>();
            if (!float.IsNaN(yMin) && b.min.y > yMin) b.SetMinMax(new Vector3(b.min.x, yMin, b.min.z), b.max);
            c.center = b.center;
            c.size = b.size;
            return c;
        }

        public void Interactive(Transform t, Func<string> label, Action action, float range = 2.4f)
        {
            var it = t.gameObject.AddComponent<Interactable>();
            it.Label = label;
            it.Action = action;
            it.Range = range;
            // Les objets sans collision reçoivent un volume « déclencheur » visé par le réticule.
            bool targetable = false;
            foreach (var col in t.GetComponentsInChildren<Collider>()) if (col.gameObject.layer != 2) targetable = true;
            if (!targetable)
            {
                var c = ColliderAround(t);
                if (c != null) { c.isTrigger = true; c.gameObject.layer = 0; c.gameObject.name = "zone d'interaction"; }
            }
        }

        public LightGroup NewLightGroup(string key, string name, bool on)
        {
            var g = new LightGroup(name, on);
            Lights[key] = g;
            return g;
        }

        public Light PointLight(Transform parent, Vector3 pos, Color color, float intensity, float range, bool shadows = false)
        {
            var go = new GameObject("lumière");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = color;
            l.intensity = intensity;
            l.range = range;
            l.shadows = shadows ? LightShadows.Soft : LightShadows.None;
            return l;
        }

        public void MarkOutdoor(Transform t)
        {
            foreach (var r in t.GetComponentsInChildren<Renderer>()) Outdoor.Add(r);
        }
    }

    /// <summary>Objet avec lequel le joueur peut interagir (touche E / clic).</summary>
    public class Interactable : MonoBehaviour
    {
        public Func<string> Label = () => "";
        public Action Action = () => { };
        public float Range = 2.4f;
    }

    /// <summary>Animation réversible 0 ↔ 1 avec easing (portes, tiroirs, store…).</summary>
    public class Toggle
    {
        public float T, Target;
        readonly float duration;
        readonly Action<float> apply;

        public Toggle(float duration, Action<float> apply, float initial = 0)
        {
            this.duration = duration; this.apply = apply;
            T = Target = initial;
            apply(Smooth(initial));
        }

        public bool On => Target >= 1f;
        public void Flip() { Target = On ? 0f : 1f; }
        static float Smooth(float t) { return t * t * (3 - 2 * t); }

        public bool Update(float dt)
        {
            if (Mathf.Approximately(T, Target)) return false;
            T = Mathf.MoveTowards(T, Target, dt / duration);
            apply(Smooth(T));
            return true;
        }
    }

    /// <summary>
    /// Groupe de lumières commandé par un interrupteur : lumières réelles + matériaux émissifs.
    /// Les lumières ne sont pas désactivées mais passent à intensité nulle, en fondu.
    /// </summary>
    public class LightGroup
    {
        public readonly string Name;
        public bool On;
        public float Level;
        public float Boost = 1f;
        public Func<float, float> Flicker;
        public event Action<bool> Changed;
        readonly List<(Light light, float baseI)> lights = new List<(Light, float)>();
        readonly List<(Material mat, Color col, float baseI)> emissive = new List<(Material, Color, float)>();

        public LightGroup(string name, bool on) { Name = name; On = on; Level = on ? 1 : 0; }

        public LightGroup Add(Light l) { lights.Add((l, l.intensity)); l.intensity *= Level; return this; }
        public LightGroup Add(Material m, Color c, float intensity) { emissive.Add((m, c, intensity)); Mat.SetEmission(m, c, intensity * Level); return this; }

        public void Toggle() { Set(!On); }
        public void Set(bool on)
        {
            if (on == On) return;
            On = on;
            Changed?.Invoke(on);
        }

        public void Update(float dt, float time)
        {
            Level = Mathf.MoveTowards(Level, On ? 1f : 0f, dt * 5f);
            float f = (Flicker != null ? Flicker(time) : 1f) * Boost * Level;
            foreach (var l in lights)
            {
                l.light.intensity = l.baseI * f;
                l.light.enabled = f > 0.001f;
            }
            foreach (var e in emissive) Mat.SetEmission(e.mat, e.col, e.baseI * f);
        }
    }
}

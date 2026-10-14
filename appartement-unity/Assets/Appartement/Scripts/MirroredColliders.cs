using System.Collections.Generic;
using UnityEngine;

namespace Appartement
{
    /// <summary>Relie un collider « monde » à l'objet du décor dont il provient (pour retrouver l'Interactable).</summary>
    public class ColliderSource : MonoBehaviour
    {
        public GameObject Source;
    }

    /// <summary>
    /// Le décor est modélisé dans le repère du plan, sous une racine de scale (1, 1, -1).
    /// PhysX n'accepte pas les échelles négatives (boîtes forcées en positif, rotations faussées) :
    /// chaque collider du décor est donc recopié dans le repère monde réel, sans échelle négative,
    /// et les colliders mobiles (portes, rideaux…) sont resynchronisés à chaque image.
    /// </summary>
    public class MirroredColliders : MonoBehaviour
    {
        class Link
        {
            public Collider Src;
            public Collider Dst;
            public bool Dynamic;
        }

        readonly List<Link> links = new List<Link>();

        /// <summary>
        /// À appeler quand la racine est encore à l'échelle 1 (décor « en plan ») :
        /// le miroir Z est alors appliqué par calcul, puis la racine peut être retournée.
        /// </summary>
        public static MirroredColliders Create(Transform root)
        {
            var host = new GameObject("Collisions (monde)");
            var mc = host.AddComponent<MirroredColliders>();
            foreach (var c in root.GetComponentsInChildren<Collider>(true))
            {
                if (!(c is BoxCollider) && !(c is CapsuleCollider)) continue;
                var p = new GameObject(c.gameObject.name);
                p.transform.SetParent(host.transform, false);
                p.layer = c.gameObject.layer;
                Collider d = c is BoxCollider ? (Collider)p.AddComponent<BoxCollider>() : p.AddComponent<CapsuleCollider>();
                d.isTrigger = c.isTrigger;
                p.AddComponent<ColliderSource>().Source = c.gameObject;
                bool dynamic = c.isTrigger || c.GetComponentInParent<Rigidbody>() != null;
                if (dynamic)
                {
                    var rb = p.AddComponent<Rigidbody>();
                    rb.isKinematic = true;
                    rb.useGravity = false;
                }
                var link = new Link { Src = c, Dst = d, Dynamic = dynamic };
                Sync(link, true);
                c.enabled = false;
                mc.links.Add(link);
            }
            return mc;
        }

        static Vector3 Abs(Vector3 v) { return new Vector3(Mathf.Abs(v.x), Mathf.Abs(v.y), Mathf.Abs(v.z)); }

        static void Sync(Link l, bool applyMirror)
        {
            var t = l.Src.transform;
            var q = t.rotation;
            // Réflexion Z appliquée à une rotation : l'axe change de signe sur X et Y.
            var rot = new Quaternion(-q.x, -q.y, q.z, q.w);
            var scale = Abs(t.lossyScale);
            var dt = l.Dst.transform;
            if (l.Src is BoxCollider sb && l.Dst is BoxCollider db)
            {
                var c = t.TransformPoint(sb.center);
                if (applyMirror) c.z = -c.z;
                dt.SetPositionAndRotation(c, rot);
                db.center = Vector3.zero;
                db.size = Vector3.Scale(Abs(sb.size), scale);
            }
            else if (l.Src is CapsuleCollider sc && l.Dst is CapsuleCollider dc)
            {
                var c = t.TransformPoint(sc.center);
                if (applyMirror) c.z = -c.z;
                dt.SetPositionAndRotation(c, rot);
                dc.center = Vector3.zero;
                dc.direction = sc.direction;
                float axial = sc.direction == 0 ? scale.x : sc.direction == 1 ? scale.y : scale.z;
                float radial = sc.direction == 0 ? Mathf.Max(scale.y, scale.z) : sc.direction == 1 ? Mathf.Max(scale.x, scale.z) : Mathf.Max(scale.x, scale.y);
                dc.height = sc.height * axial;
                dc.radius = sc.radius * radial;
            }
        }

        void FixedUpdate() { SyncDynamic(); }
        void LateUpdate() { SyncDynamic(); }

        void SyncDynamic()
        {
            foreach (var l in links)
                if (l.Dynamic && l.Src != null) Sync(l, false);
        }
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Générateurs de maillages en mètres, avec UV « boîte » métriques (1 unité UV = 1 m),
    /// ce qui évite toute texture étirée. L'orientation des triangles est corrigée
    /// automatiquement d'après la normale voulue.
    /// </summary>
    public class MeshBuilder
    {
        readonly List<Vector3> v = new List<Vector3>();
        readonly List<Vector3> n = new List<Vector3>();
        readonly List<int> t = new List<int>();
        public Vector3 UvOffset;

        public int Vert(Vector3 p, Vector3 normal) { v.Add(p); n.Add(normal); return v.Count - 1; }

        public void Tri(int a, int b, int c, Vector3 outward)
        {
            var f = Vector3.Cross(v[b] - v[a], v[c] - v[a]);
            if (Vector3.Dot(f, outward) < 0) { int k = b; b = c; c = k; }
            t.Add(a); t.Add(b); t.Add(c);
        }

        public void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 normal)
        {
            int ia = Vert(a, normal), ib = Vert(b, normal), ic = Vert(c, normal), id = Vert(d, normal);
            Tri(ia, ib, ic, normal);
            Tri(ia, ic, id, normal);
        }

        public Mesh Build(string name = "mesh")
        {
            var m = new Mesh { name = name };
            if (v.Count > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(v);
            m.SetNormals(n);
            var uv = new List<Vector2>(v.Count);
            for (int i = 0; i < v.Count; i++) uv.Add(BoxUV(v[i] + UvOffset, n[i]));
            m.SetUVs(0, uv);
            m.SetTriangles(t, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        public static Vector2 BoxUV(Vector3 p, Vector3 nrm)
        {
            float ax = Mathf.Abs(nrm.x), ay = Mathf.Abs(nrm.y), az = Mathf.Abs(nrm.z);
            if (ax >= ay && ax >= az) return new Vector2(p.z, p.y);
            if (ay >= az) return new Vector2(p.x, p.z);
            return new Vector2(p.x, p.y);
        }
    }

    public static class MeshGen
    {
        static readonly Dictionary<string, Mesh> cache = new Dictionary<string, Mesh>();

        /// <summary>Boîte centrée sur l'origine, une sous-maille par face (+x, -x, +y, -y, +z, -z).</summary>
        public static Mesh Box(Vector3 size, Vector3 uvOffset, bool faceSubmeshes = false)
        {
            var h = size * 0.5f;
            var dirs = new[] { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };
            var verts = new List<Vector3>(); var norms = new List<Vector3>(); var uvs = new List<Vector2>();
            var subs = new List<List<int>>();
            foreach (var d in dirs)
            {
                Vector3 a, b;
                if (d.x != 0) { a = Vector3.forward; b = Vector3.up; }
                else if (d.y != 0) { a = Vector3.right; b = Vector3.forward; }
                else { a = Vector3.right; b = Vector3.up; }
                var c = Vector3.Scale(d, h);
                var ea = Vector3.Scale(a, h); var eb = Vector3.Scale(b, h);
                int i0 = verts.Count;
                var quad = new[] { c - ea - eb, c + ea - eb, c + ea + eb, c - ea + eb };
                foreach (var q in quad) { verts.Add(q); norms.Add(d); uvs.Add(MeshBuilder.BoxUV(q + uvOffset, d)); }
                var tri = new List<int>();
                var f = Vector3.Cross(quad[1] - quad[0], quad[2] - quad[0]);
                if (Vector3.Dot(f, d) >= 0) tri.AddRange(new[] { i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3 });
                else tri.AddRange(new[] { i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2 });
                subs.Add(tri);
            }
            var m = new Mesh { name = "box" };
            m.SetVertices(verts); m.SetNormals(norms); m.SetUVs(0, uvs);
            if (faceSubmeshes)
            {
                m.subMeshCount = 6;
                for (int i = 0; i < 6; i++) m.SetTriangles(subs[i], i);
            }
            else
            {
                var all = new List<int>();
                foreach (var s in subs) all.AddRange(s);
                m.SetTriangles(all, 0);
            }
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        /// <summary>Boîte aux arêtes arrondies (coussins, matelas, électroménager).</summary>
        public static Mesh RoundedBox(Vector3 size, float radius, int seg, Vector3 uvOffset)
        {
            var h = size * 0.5f;
            radius = Mathf.Min(radius, h.x, h.y, h.z) * 0.999f;
            float[] Axis(float half)
            {
                var l = new List<float>();
                for (int i = 0; i <= seg; i++) l.Add(-half + radius * i / seg);
                for (int i = seg; i >= 0; i--) l.Add(half - radius * i / seg);
                return l.ToArray();
            }
            var ax = Axis(h.x); var ay = Axis(h.y); var az = Axis(h.z);
            var mb = new MeshBuilder { UvOffset = uvOffset };
            var inner = h - Vector3.one * radius;
            Vector3 Map(Vector3 p, Vector3 faceN, out Vector3 nrm)
            {
                var c = new Vector3(Mathf.Clamp(p.x, -inner.x, inner.x), Mathf.Clamp(p.y, -inner.y, inner.y), Mathf.Clamp(p.z, -inner.z, inner.z));
                var d = p - c;
                nrm = d.sqrMagnitude > 1e-10f ? d.normalized : faceN;
                return c + nrm * radius;
            }
            void Face(Vector3 normal, float[] ua, float[] va, System.Func<float, float, Vector3> pt)
            {
                var idx = new int[ua.Length, va.Length];
                for (int i = 0; i < ua.Length; i++)
                    for (int j = 0; j < va.Length; j++)
                    {
                        var p = Map(pt(ua[i], va[j]), normal, out var nn);
                        idx[i, j] = mb.Vert(p, nn);
                    }
                for (int i = 0; i < ua.Length - 1; i++)
                    for (int j = 0; j < va.Length - 1; j++)
                    {
                        mb.Tri(idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], normal);
                        mb.Tri(idx[i, j], idx[i + 1, j + 1], idx[i, j + 1], normal);
                    }
            }
            Face(Vector3.right, az, ay, (a, b) => new Vector3(h.x, b, a));
            Face(Vector3.left, az, ay, (a, b) => new Vector3(-h.x, b, a));
            Face(Vector3.up, ax, az, (a, b) => new Vector3(a, h.y, b));
            Face(Vector3.down, ax, az, (a, b) => new Vector3(a, -h.y, b));
            Face(Vector3.forward, ax, ay, (a, b) => new Vector3(a, b, h.z));
            Face(Vector3.back, ax, ay, (a, b) => new Vector3(a, b, -h.z));
            return mb.Build("roundedBox");
        }

        /// <summary>Cylindre / tronc de cône vertical. Peu de segments = facettes nettes (octogone du spa).</summary>
        public static Mesh Cylinder(float rTop, float rBottom, float height, int seg, bool caps, Vector3 uvOffset)
        {
            var mb = new MeshBuilder { UvOffset = uvOffset };
            bool flat = seg <= 12;
            float hh = height / 2;
            for (int i = 0; i < seg; i++)
            {
                float a0 = i * Mathf.PI * 2 / seg, a1 = (i + 1) * Mathf.PI * 2 / seg;
                var d0 = new Vector3(Mathf.Cos(a0), 0, Mathf.Sin(a0)); var d1 = new Vector3(Mathf.Cos(a1), 0, Mathf.Sin(a1));
                var slope = (rBottom - rTop) / Mathf.Max(height, 1e-4f);
                Vector3 n0 = (d0 + Vector3.up * slope).normalized, n1 = (d1 + Vector3.up * slope).normalized;
                if (flat) { var nm = ((d0 + d1) * 0.5f + Vector3.up * slope).normalized; n0 = n1 = nm; }
                int b0 = mb.Vert(d0 * rBottom - Vector3.up * hh, n0), b1 = mb.Vert(d1 * rBottom - Vector3.up * hh, n1);
                int t0 = mb.Vert(d0 * rTop + Vector3.up * hh, n0), t1 = mb.Vert(d1 * rTop + Vector3.up * hh, n1);
                var outw = (d0 + d1) * 0.5f;
                mb.Tri(b0, b1, t1, outw); mb.Tri(b0, t1, t0, outw);
                if (caps)
                {
                    int c = mb.Vert(Vector3.up * hh, Vector3.up), p0 = mb.Vert(d0 * rTop + Vector3.up * hh, Vector3.up), p1 = mb.Vert(d1 * rTop + Vector3.up * hh, Vector3.up);
                    mb.Tri(c, p0, p1, Vector3.up);
                    int c2 = mb.Vert(-Vector3.up * hh, Vector3.down), q0 = mb.Vert(d0 * rBottom - Vector3.up * hh, Vector3.down), q1 = mb.Vert(d1 * rBottom - Vector3.up * hh, Vector3.down);
                    mb.Tri(c2, q0, q1, Vector3.down);
                }
            }
            return mb.Build("cylinder");
        }

        /// <summary>Surface de révolution (vasque) à partir d'un profil (rayon, hauteur).</summary>
        public static Mesh Lathe(Vector2[] profile, int seg, Vector3 uvOffset)
        {
            var mb = new MeshBuilder { UvOffset = uvOffset };
            int rows = profile.Length;
            var idx = new int[seg + 1, rows];
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2 / seg;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                for (int j = 0; j < rows; j++)
                {
                    var prev = profile[Mathf.Max(0, j - 1)]; var next = profile[Mathf.Min(rows - 1, j + 1)];
                    var tan = next - prev;
                    var n2 = new Vector2(tan.y, -tan.x).normalized; // normale du profil
                    var nrm = (d * n2.x + Vector3.up * n2.y).normalized;
                    idx[i, j] = mb.Vert(d * profile[j].x + Vector3.up * profile[j].y, nrm);
                }
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < rows - 1; j++)
                {
                    float a = (i + 0.5f) * Mathf.PI * 2 / seg;
                    var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                    var p = profile[j + 1] - profile[j];
                    var n2 = new Vector2(p.y, -p.x);
                    var outw = d * n2.x + Vector3.up * n2.y;
                    mb.Tri(idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], outw);
                    mb.Tri(idx[i, j], idx[i + 1, j + 1], idx[i, j + 1], outw);
                }
            return mb.Build("lathe");
        }

        /// <summary>Tore (bouée du spa, abattant). Axe vertical.</summary>
        public static Mesh Torus(float radius, float tube, int radial, int tubular, Vector3 uvOffset)
        {
            var mb = new MeshBuilder { UvOffset = uvOffset };
            var idx = new int[radial + 1, tubular + 1];
            for (int i = 0; i <= radial; i++)
            {
                float a = i * Mathf.PI * 2 / radial; var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                for (int j = 0; j <= tubular; j++)
                {
                    float b = j * Mathf.PI * 2 / tubular;
                    var nrm = d * Mathf.Cos(b) + Vector3.up * Mathf.Sin(b);
                    idx[i, j] = mb.Vert(d * radius + nrm * tube, nrm);
                }
            }
            for (int i = 0; i < radial; i++)
                for (int j = 0; j < tubular; j++)
                {
                    float a = (i + 0.5f) * Mathf.PI * 2 / radial, b = (j + 0.5f) * Mathf.PI * 2 / tubular;
                    var outw = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * Mathf.Cos(b) + Vector3.up * Mathf.Sin(b);
                    mb.Tri(idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], outw);
                    mb.Tri(idx[i, j], idx[i + 1, j + 1], idx[i, j + 1], outw);
                }
            return mb.Build("torus");
        }

        /// <summary>Bloc en arc de couronne (mobilier circulaire du spa). Angles dans le plan XZ (radians).</summary>
        public static Mesh Arc(float r0, float r1, float a0, float a1, float height, Vector3 uvOffset)
        {
            var mb = new MeshBuilder { UvOffset = uvOffset };
            int seg = Mathf.Max(4, Mathf.CeilToInt((a1 - a0) / (Mathf.PI / 24)));
            Vector3 D(float a) { return new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)); }
            for (int i = 0; i < seg; i++)
            {
                float t0 = Mathf.Lerp(a0, a1, (float)i / seg), t1 = Mathf.Lerp(a0, a1, (float)(i + 1) / seg);
                Vector3 d0 = D(t0), d1 = D(t1), up = Vector3.up * height;
                mb.Quad(d0 * r1, d1 * r1, d1 * r1 + up, d0 * r1 + up, (d0 + d1).normalized);   // extérieur
                mb.Quad(d0 * r0, d1 * r0, d1 * r0 + up, d0 * r0 + up, -(d0 + d1).normalized);  // intérieur
                mb.Quad(d0 * r0 + up, d1 * r0 + up, d1 * r1 + up, d0 * r1 + up, Vector3.up);
                mb.Quad(d0 * r0, d1 * r0, d1 * r1, d0 * r1, Vector3.down);
            }
            Vector3 e0 = D(a0), e1 = D(a1);
            var tan0 = new Vector3(Mathf.Sin(a0), 0, -Mathf.Cos(a0)); var tan1 = -new Vector3(Mathf.Sin(a1), 0, -Mathf.Cos(a1));
            mb.Quad(e0 * r0, e0 * r1, e0 * r1 + Vector3.up * height, e0 * r0 + Vector3.up * height, tan0);
            mb.Quad(e1 * r0, e1 * r1, e1 * r1 + Vector3.up * height, e1 * r0 + Vector3.up * height, tan1);
            return mb.Build("arc");
        }

        /// <summary>Surface à partir d'une grille de points (couette, rideaux, store). Normales lissées.</summary>
        public static void FillGrid(Mesh mesh, Vector3[,] pts, Vector3 outward, Vector3 uvOffset)
        {
            int nu = pts.GetLength(0), nv = pts.GetLength(1);
            var verts = new Vector3[nu * nv];
            var norms = new Vector3[nu * nv];
            var uv = new Vector2[nu * nv];
            for (int i = 0; i < nu; i++)
                for (int j = 0; j < nv; j++)
                {
                    verts[i * nv + j] = pts[i, j];
                    var du = pts[Mathf.Min(nu - 1, i + 1), j] - pts[Mathf.Max(0, i - 1), j];
                    var dv = pts[i, Mathf.Min(nv - 1, j + 1)] - pts[i, Mathf.Max(0, j - 1)];
                    var nn = Vector3.Cross(du, dv).normalized;
                    if (Vector3.Dot(nn, outward) < 0) nn = -nn;
                    norms[i * nv + j] = nn;
                    uv[i * nv + j] = MeshBuilder.BoxUV(pts[i, j] + uvOffset, nn);
                }
            var tris = new int[(nu - 1) * (nv - 1) * 6];
            int k = 0;
            for (int i = 0; i < nu - 1; i++)
                for (int j = 0; j < nv - 1; j++)
                {
                    int a = i * nv + j, b = (i + 1) * nv + j, c = (i + 1) * nv + j + 1, d = i * nv + j + 1;
                    var f = Vector3.Cross(verts[b] - verts[a], verts[c] - verts[a]);
                    bool flip = Vector3.Dot(f, norms[a] + norms[c]) < 0;
                    if (!flip) { tris[k++] = a; tris[k++] = b; tris[k++] = c; tris[k++] = a; tris[k++] = c; tris[k++] = d; }
                    else { tris[k++] = a; tris[k++] = c; tris[k++] = b; tris[k++] = a; tris[k++] = d; tris[k++] = c; }
                }
            mesh.Clear();
            mesh.vertices = verts;
            mesh.normals = norms;
            mesh.uv = uv;
            mesh.triangles = tris;
            mesh.RecalculateBounds();
        }

        /// <summary>Forme plane fermée (miroir festonné) dans le plan XY, normale +Z.</summary>
        public static Mesh Polygon(Vector2[] outline)
        {
            var mb = new MeshBuilder();
            int c = mb.Vert(Vector3.zero, Vector3.forward);
            var ids = new int[outline.Length];
            for (int i = 0; i < outline.Length; i++) ids[i] = mb.Vert(outline[i], Vector3.forward);
            for (int i = 0; i < outline.Length; i++) mb.Tri(c, ids[i], ids[(i + 1) % outline.Length], Vector3.forward);
            return mb.Build("polygon");
        }

        public static Mesh Sphere(float r, int seg)
        {
            string key = "sphere" + r + "_" + seg;
            if (cache.TryGetValue(key, out var m)) return m;
            var mb = new MeshBuilder();
            var idx = new int[seg + 1, seg + 1];
            for (int i = 0; i <= seg; i++)
                for (int j = 0; j <= seg; j++)
                {
                    float th = i * Mathf.PI / seg, ph = j * Mathf.PI * 2 / seg;
                    var d = new Vector3(Mathf.Sin(th) * Mathf.Cos(ph), Mathf.Cos(th), Mathf.Sin(th) * Mathf.Sin(ph));
                    idx[i, j] = mb.Vert(d * r, d);
                }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < seg; j++)
                {
                    float th = (i + 0.5f) * Mathf.PI / seg, ph = (j + 0.5f) * Mathf.PI * 2 / seg;
                    var o = new Vector3(Mathf.Sin(th) * Mathf.Cos(ph), Mathf.Cos(th), Mathf.Sin(th) * Mathf.Sin(ph));
                    mb.Tri(idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], o);
                    mb.Tri(idx[i, j], idx[i + 1, j + 1], idx[i, j + 1], o);
                }
            m = mb.Build("sphere");
            cache[key] = m;
            return m;
        }
    }
}

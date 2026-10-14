using UnityEngine;

namespace Appartement
{
    /// <summary>Systèmes de particules : eau de la douche, bulles du spa.</summary>
    public static class Effects
    {
        static Material particleMat;

        static Material ParticleMaterial()
        {
            if (particleMat != null) return particleMat;
            var sh = Mat.Urp ? Shader.Find("Universal Render Pipeline/Particles/Unlit") : null;
            if (sh == null) sh = Shader.Find("Particles/Standard Unlit");
            if (sh == null) sh = Shader.Find("Sprites/Default");
            particleMat = new Material(sh);
            // Petite tache ronde et douce
            const int s = 32;
            var tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(s / 2f, s / 2f)) / (s / 2f);
                    tex.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(1 - d * d)));
                }
            tex.Apply();
            particleMat.mainTexture = tex;
            if (particleMat.HasProperty("_BaseMap")) particleMat.SetTexture("_BaseMap", tex);
            if (Mat.Urp)
            {
                particleMat.SetFloat("_Surface", 1f);
                particleMat.SetFloat("_Blend", 0f);
                particleMat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            }
            particleMat.renderQueue = 3100;
            return particleMat;
        }

        static ParticleSystem Create(GameObject go)
        {
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = ParticleMaterial();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var main = ps.main;
            main.playOnAwake = false;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            return ps;
        }

        /// <summary>Pluie de la douche à effet pluie (filets d'eau tombant du pommeau).</summary>
        public static ParticleSystem Rain(GameObject go)
        {
            var ps = Create(go);
            var main = ps.main;
            main.startLifetime = 0.55f;
            main.startSpeed = 0f;
            main.startSize = 0.012f;
            main.startColor = new Color(0.82f, 0.92f, 1f, 0.55f);
            main.gravityModifier = 1.3f;
            main.maxParticles = 1500;
            var em = ps.emission;
            em.rateOverTime = 900f;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(0.22f, 0.01f, 0.22f);
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.03f;
            r.lengthScale = 2f;
            return ps;
        }

        /// <summary>Bulles des jets du spa, à la surface de l'eau.</summary>
        public static ParticleSystem Bubbles(GameObject go, float radius)
        {
            var ps = Create(go);
            var main = ps.main;
            main.startLifetime = new ParticleSystem.MinMaxCurve(0.4f, 1.0f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.02f, 0.08f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.015f, 0.04f);
            main.startColor = new Color(1f, 1f, 1f, 0.75f);
            main.maxParticles = 600;
            var em = ps.emission;
            em.rateOverTime = 350f;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Circle;
            shape.radius = radius;
            shape.rotation = new Vector3(-90, 0, 0);
            return ps;
        }
    }
}

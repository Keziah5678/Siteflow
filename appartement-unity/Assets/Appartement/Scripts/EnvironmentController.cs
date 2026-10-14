using UnityEngine;
using UnityEngine.Rendering;

namespace Appartement
{
    /// <summary>
    /// Lumière naturelle : soleil du matin (ombres douces), ciel procédural, ambiance,
    /// mode nuit avec étoiles, sondes de réflexion recalculées depuis la scène.
    /// </summary>
    public class EnvironmentController : MonoBehaviour
    {
        public bool Night { get; private set; }
        public float NightFactor { get; private set; }
        public Builder Builder;

        Light sun;
        Material sky;
        ParticleSystem stars;
        ReflectionProbe[] probes;
        float dirty = -1f;

        static readonly Color SunCol = new Color(1f, 0.95f, 0.87f);

        public void Init(Builder b)
        {
            Builder = b;
            // Soleil venant de l'est-sud-est, 30° au-dessus de l'horizon : il entre par la baie vitrée.
            var sunGo = new GameObject("Soleil");
            sunGo.transform.SetParent(transform, false);
            var dirPlan = new Vector3(Mathf.Cos(30 * Mathf.Deg2Rad) * Mathf.Cos(18 * Mathf.Deg2Rad), Mathf.Sin(30 * Mathf.Deg2Rad), Mathf.Cos(30 * Mathf.Deg2Rad) * Mathf.Sin(18 * Mathf.Deg2Rad));
            var toSun = Layout.ToWorld(dirPlan).normalized;
            sunGo.transform.rotation = Quaternion.LookRotation(-toSun, Vector3.up);
            sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = SunCol;
            sun.intensity = 1.6f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.92f;
            sun.shadowBias = 0.03f;
            sun.shadowNormalBias = 0.3f;
            RenderSettings.sun = sun;
            QualitySettings.shadowDistance = Mathf.Max(QualitySettings.shadowDistance, 35f);

            var skyShader = Shader.Find("Skybox/Procedural");
            if (skyShader != null)
            {
                sky = new Material(skyShader);
                sky.SetFloat("_SunSize", 0.035f);
                sky.SetFloat("_AtmosphereThickness", 0.9f);
                sky.SetColor("_SkyTint", new Color(0.5f, 0.6f, 0.75f));
                sky.SetColor("_GroundColor", new Color(0.45f, 0.43f, 0.4f));
                sky.SetFloat("_Exposure", 1.25f);
                RenderSettings.skybox = sky;
            }
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.fog = false;
            DynamicGI.UpdateEnvironment();

            Stars();
            Probes();
            Apply();
        }

        void Stars()
        {
            var go = new GameObject("Étoiles");
            go.transform.SetParent(transform, false);
            stars = go.AddComponent<ParticleSystem>();
            stars.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = stars.main;
            main.playOnAwake = false;
            main.loop = false;
            main.maxParticles = 1500;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = stars.emission;
            em.enabled = false;
            var r = go.GetComponent<ParticleSystemRenderer>();
            var sh = Shader.Find(Mat.Urp ? "Universal Render Pipeline/Particles/Unlit" : "Particles/Standard Unlit");
            if (sh == null) sh = Shader.Find("Sprites/Default");
            r.sharedMaterial = new Material(sh);
            var pts = new ParticleSystem.Particle[1500];
            var rnd = new System.Random(4);
            for (int i = 0; i < pts.Length; i++)
            {
                float th = (float)rnd.NextDouble() * Mathf.PI * 2, ph = Mathf.Acos((float)rnd.NextDouble() * 0.95f);
                pts[i].position = new Vector3(Mathf.Sin(ph) * Mathf.Cos(th), Mathf.Cos(ph), Mathf.Sin(ph) * Mathf.Sin(th)) * 90f;
                pts[i].startSize = 0.25f + (float)rnd.NextDouble() * 0.3f;
                pts[i].startColor = Color.white;
                pts[i].remainingLifetime = 1e6f;
                pts[i].startLifetime = 1e6f;
            }
            stars.SetParticles(pts, pts.Length);
            stars.Pause();
            r.enabled = false;
        }

        void Probes()
        {
            ReflectionProbe Probe(string name, Vector3 planCenter, Vector3 size)
            {
                var go = new GameObject(name);
                go.transform.SetParent(transform, false);
                go.transform.position = Layout.ToWorld(planCenter);
                var p = go.AddComponent<ReflectionProbe>();
                p.mode = ReflectionProbeMode.Realtime;
                p.refreshMode = ReflectionProbeRefreshMode.ViaScripting;
                p.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
                p.boxProjection = true;
                p.size = size;
                p.resolution = 128;
                p.hdr = true;
                p.importance = 1;
                p.blendDistance = 0.5f;
                return p;
            }
            probes = new[]
            {
                Probe("Reflets séjour", new Vector3(1.8f, 1.45f, 2.6f), new Vector3(3.8f, 2.8f, 5.2f)),
                Probe("Reflets salle de bain", new Vector3(3.75f, 1.4f, 5.55f), new Vector3(2.3f, 2.8f, 2.1f)),
                Probe("Reflets jardin", new Vector3(6.6f, 1.5f, 1.6f), new Vector3(6.6f, 5f, 6f)),
            };
            probes[2].importance = 0;
        }

        public void RefreshReflections() { dirty = 0.35f; }

        public void SetNight(bool night) { Night = night; }

        void Update()
        {
            float target = Night ? 1 : 0;
            float prev = NightFactor;
            NightFactor = Mathf.MoveTowards(NightFactor, target, Time.deltaTime * 0.6f);
            if (!Mathf.Approximately(prev, NightFactor)) { Apply(); dirty = Mathf.Max(dirty, 0.05f); }
            if (dirty > 0)
            {
                dirty -= Time.deltaTime;
                if (dirty <= 0) { foreach (var p in probes) p.RenderProbe(); dirty = -1; }
            }
        }

        void Apply()
        {
            float k = NightFactor;
            sun.intensity = 1.6f * (1 - k);
            sun.enabled = k < 0.99f;
            if (sky != null)
            {
                sky.SetFloat("_Exposure", Mathf.Lerp(1.25f, 0.02f, k));
                sky.SetColor("_SkyTint", Color.Lerp(new Color(0.5f, 0.6f, 0.75f), new Color(0.05f, 0.08f, 0.2f), k));
            }
            RenderSettings.ambientSkyColor = Color.Lerp(new Color(0.62f, 0.68f, 0.78f), new Color(0.04f, 0.05f, 0.09f), k);
            RenderSettings.ambientEquatorColor = Color.Lerp(new Color(0.55f, 0.55f, 0.53f), new Color(0.03f, 0.03f, 0.05f), k);
            RenderSettings.ambientGroundColor = Color.Lerp(new Color(0.36f, 0.33f, 0.29f), new Color(0.02f, 0.02f, 0.03f), k);
            RenderSettings.reflectionIntensity = Mathf.Lerp(1f, 0.5f, k);
            var r = stars.GetComponent<ParticleSystemRenderer>();
            r.enabled = k > 0.3f;
            if (Builder != null && Builder.Lights.TryGetValue("garden", out var g)) g.Boost = 0.25f + 0.75f * k;
        }
    }
}

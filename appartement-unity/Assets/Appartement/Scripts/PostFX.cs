using System;
using System.Reflection;
using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Post-traitement URP (tone mapping neutre, halo lumineux, exposition adaptative).
    /// Les types URP sont résolus par réflexion : le projet compile aussi avec le pipeline intégré,
    /// où ces effets sont simplement absents.
    /// </summary>
    public class PostFX
    {
        object colorAdjustments;
        public bool Available { get; private set; }

        static Type T(string name, string asm) { return Type.GetType(name + ", " + asm); }

        public static PostFX Setup(Camera cam)
        {
            var fx = new PostFX();
            if (!Mat.Urp) return fx;
            try
            {
                const string core = "Unity.RenderPipelines.Core.Runtime", urp = "Unity.RenderPipelines.Universal.Runtime";
                var volumeT = T("UnityEngine.Rendering.Volume", core);
                var profileT = T("UnityEngine.Rendering.VolumeProfile", core);
                var bloomT = T("UnityEngine.Rendering.Universal.Bloom", urp);
                var toneT = T("UnityEngine.Rendering.Universal.Tonemapping", urp);
                var adjT = T("UnityEngine.Rendering.Universal.ColorAdjustments", urp);
                var camDataT = T("UnityEngine.Rendering.Universal.UniversalAdditionalCameraData", urp);
                if (volumeT == null || profileT == null) return fx;

                var go = new GameObject("Post-traitement");
                var vol = go.AddComponent(volumeT);
                SetMember(vol, "isGlobal", true);
                SetMember(vol, "priority", 10f);
                var profile = ScriptableObject.CreateInstance(profileT);
                SetMember(vol, "sharedProfile", profile);
                var add = profileT.GetMethod("Add", new[] { typeof(Type), typeof(bool) });
                if (add == null) return fx;
                if (bloomT != null)
                {
                    var bloom = add.Invoke(profile, new object[] { bloomT, true });
                    SetParam(bloom, "intensity", 0.35f);
                    SetParam(bloom, "threshold", 1.1f);
                    SetParam(bloom, "scatter", 0.6f);
                }
                if (toneT != null)
                {
                    var tone = add.Invoke(profile, new object[] { toneT, true });
                    SetParam(tone, "mode", 1); // TonemappingMode.Neutral
                }
                if (adjT != null)
                {
                    fx.colorAdjustments = add.Invoke(profile, new object[] { adjT, true });
                    SetParam(fx.colorAdjustments, "postExposure", 0f);
                    SetParam(fx.colorAdjustments, "contrast", 4f);
                }
                if (camDataT != null)
                {
                    var data = cam.GetComponent(camDataT);
                    if (data == null) data = cam.gameObject.AddComponent(camDataT);
                    SetMember(data, "renderPostProcessing", true);
                    SetMember(data, "antialiasing", 2); // SMAA
                    SetMember(data, "renderShadows", true);
                }
                fx.Available = true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("Appartement 3D : post-traitement URP non configuré (" + e.Message + ")");
            }
            return fx;
        }

        /// <summary>Exposition en IL (EV) : adaptation intérieur / extérieur.</summary>
        public void SetExposure(float ev)
        {
            if (colorAdjustments != null) SetParam(colorAdjustments, "postExposure", ev);
        }

        static void SetMember(object target, string name, object value)
        {
            var t = target.GetType();
            var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
            if (p != null && p.CanWrite) { p.SetValue(target, Convert(value, p.PropertyType)); return; }
            var f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
            if (f != null) f.SetValue(target, Convert(value, f.FieldType));
        }

        /// <summary>Règle un VolumeParameter (champ public) : valeur + override.</summary>
        static void SetParam(object component, string field, object value)
        {
            var f = component.GetType().GetField(field, BindingFlags.Public | BindingFlags.Instance);
            var param = f?.GetValue(component);
            if (param == null) return;
            var pt = param.GetType();
            pt.GetProperty("overrideState")?.SetValue(param, true);
            var vp = pt.GetProperty("value");
            if (vp != null && vp.CanWrite) vp.SetValue(param, Convert(value, vp.PropertyType));
        }

        static object Convert(object value, Type to)
        {
            if (value == null || to.IsInstanceOfType(value)) return value;
            if (to.IsEnum) return Enum.ToObject(to, value);
            return System.Convert.ChangeType(value, to);
        }
    }
}

using UnityEngine;
using UnityEngine.Rendering;

namespace Appartement
{
    /// <summary>
    /// Fabrique de matériaux PBR fonctionnant avec l'URP (Universal Render Pipeline/Lit)
    /// comme avec le pipeline intégré (Standard). Le pipeline actif est détecté au lancement.
    /// </summary>
    public static class Mat
    {
        public static bool Urp => GraphicsSettings.currentRenderPipeline != null;

        static Shader litShader;
        static Material template;

        static Material NewLit()
        {
            if (template == null) template = Resources.Load<Material>("AppartementLit");
            if (template != null && template.shader != null && template.shader.isSupported) return new Material(template);
            if (litShader == null)
            {
                litShader = Urp ? Shader.Find("Universal Render Pipeline/Lit") : Shader.Find("Standard");
                if (litShader == null) litShader = Shader.Find("Standard");
            }
            return new Material(litShader);
        }

        static string ColorProp => Urp ? "_BaseColor" : "_Color";
        static string MapProp => Urp ? "_BaseMap" : "_MainTex";
        static string SmoothProp => Urp ? "_Smoothness" : "_Glossiness";

        public static Material Lit(Color color, float smoothness = 0.3f, float metallic = 0f, TexSet tex = null)
        {
            var m = NewLit();
            m.SetColor(ColorProp, color);
            m.SetFloat(SmoothProp, smoothness);
            m.SetFloat("_Metallic", metallic);
            if (tex != null)
            {
                var scale = new Vector2(1f / tex.Meters.x, 1f / tex.Meters.y);
                m.SetTexture(MapProp, tex.Albedo);
                m.SetTextureScale(MapProp, scale);
                if (tex.Normal != null)
                {
                    m.SetTexture("_BumpMap", tex.Normal);
                    m.SetTextureScale("_BumpMap", scale);
                    m.SetFloat("_BumpScale", tex.NormalStrength);
                    m.EnableKeyword("_NORMALMAP");
                }
            }
            return m;
        }

        public static Material Lit(TexSet tex, float smoothness = 0.3f, float metallic = 0f)
        {
            return Lit(Color.white, smoothness, metallic, tex);
        }

        /// <summary>Active l'émission (LED, écrans). L'intensité se règle via <see cref="SetEmission"/>.</summary>
        public static Material Emissive(Color color, float intensity, Texture tex = null)
        {
            var m = Lit(Color.black, 0.5f);
            m.EnableKeyword("_EMISSION");
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            if (tex != null) m.SetTexture("_EmissionMap", tex);
            m.SetColor("_EmissionColor", color * intensity);
            return m;
        }

        public static void SetEmission(Material m, Color baseColor, float intensity)
        {
            m.SetColor("_EmissionColor", baseColor * intensity);
        }

        /// <summary>Matériau transparent (verre, voilages, eau).</summary>
        public static Material Transparent(Color color, float smoothness, TexSet tex = null, bool doubleSided = true)
        {
            var m = Lit(color, smoothness, 0f, tex);
            if (Urp)
            {
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", 0f);
                m.SetFloat("_Cull", doubleSided ? 0f : 2f);
                m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
                m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
                m.SetFloat("_ZWrite", 0f);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.SetOverrideTag("RenderType", "Transparent");
            }
            else
            {
                m.SetFloat("_Mode", 3f);
                m.SetInt("_SrcBlend", (int)BlendMode.One);
                m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.DisableKeyword("_ALPHATEST_ON");
                m.DisableKeyword("_ALPHABLEND_ON");
                m.EnableKeyword("_ALPHAPREMULTIPLY_ON");
                m.SetOverrideTag("RenderType", "Transparent");
            }
            m.renderQueue = (int)RenderQueue.Transparent;
            return m;
        }

        /// <summary>Découpe alpha (feuillages).</summary>
        public static Material Cutout(Texture2D tex, float cutoff = 0.45f)
        {
            var m = Lit(Color.white, 0.25f);
            m.SetTexture(MapProp, tex);
            m.SetFloat("_Cutoff", cutoff);
            if (Urp)
            {
                m.SetFloat("_AlphaClip", 1f);
                m.SetFloat("_Cull", 0f);
            }
            else
            {
                m.SetFloat("_Mode", 1f);
            }
            m.EnableKeyword("_ALPHATEST_ON");
            m.SetOverrideTag("RenderType", "TransparentCutout");
            m.renderQueue = (int)RenderQueue.AlphaTest;
            return m;
        }
    }

    /// <summary>Tous les matériaux de l'appartement.</summary>
    public class Materials
    {
        public Material FloorWood, Wall, Ceiling, Plaster, Baseboard, MarbleFloor, MarbleWall, MarbleBlack;
        public Material OakLight, OakTable, OakDoor, Slats, Boucle, Felt, Sheet, Pillow, TowelBlack, CushionBeige, Doormat;
        public Material GreyFurniture, Anthracite, BlackMatte, BlackMetal, Steel, Chrome, WhitePlastic, WhiteGloss, Ceramic;
        public Material Glass, GlassShower, Curtain, Grass, Ivy, Rattan, Awning, Water, JacuzziShell, JacuzziLiner, Ground;
        public Material LeafBanana, LeafPalm, Trunk, Mirror, ScreenTv, LampDiffuser, Red, BlueTowel;
        public Texture2D WaterNormal;

        static Color C(int hex) { return new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, 1f); }

        public static Materials Create()
        {
            var m = new Materials();
            m.FloorWood = Mat.Lit(ProceduralTextures.WoodFloor(), 0.55f);
            var paint = ProceduralTextures.PaintWall();
            m.Wall = Mat.Lit(paint, 0.08f);
            m.Ceiling = Mat.Lit(C(0xfbfaf8), 0.05f, 0, paint);
            m.Plaster = Mat.Lit(ProceduralTextures.Plaster(), 0.02f);
            m.Baseboard = Mat.Lit(C(0xece8e0), 0.4f);
            m.MarbleFloor = Mat.Lit(ProceduralTextures.MarbleWhite(), 0.85f);
            var mw = ProceduralTextures.MarbleWhite();
            mw.Meters = new Vector2(0.6f, 1.2f);
            m.MarbleWall = Mat.Lit(mw, 0.85f);
            m.MarbleBlack = Mat.Lit(ProceduralTextures.MarbleBlack(), 0.9f);
            m.OakLight = Mat.Lit(ProceduralTextures.Oak(61, new Color(0.81f, 0.71f, 0.57f)), 0.35f);
            m.OakTable = Mat.Lit(ProceduralTextures.Oak(62, new Color(0.73f, 0.57f, 0.41f)), 0.4f);
            m.OakDoor = Mat.Lit(ProceduralTextures.Oak(63, new Color(0.8f, 0.73f, 0.63f)), 0.35f);
            m.Slats = Mat.Lit(ProceduralTextures.Slats(), 0.4f);
            m.Boucle = Mat.Lit(ProceduralTextures.Boucle(), 0.05f);
            m.Felt = Mat.Lit(ProceduralTextures.Felt(), 0.08f);
            m.Sheet = Mat.Lit(ProceduralTextures.Linen(new Color(0.96f, 0.96f, 0.95f), 12), 0.1f);
            m.Pillow = Mat.Lit(ProceduralTextures.Linen(new Color(0.97f, 0.97f, 0.96f), 13), 0.1f);
            m.TowelBlack = Mat.Lit(ProceduralTextures.Linen(new Color(0.12f, 0.13f, 0.16f), 14, 0.08f), 0.02f);
            m.CushionBeige = Mat.Lit(ProceduralTextures.Linen(new Color(0.78f, 0.72f, 0.63f), 15, 0.2f), 0.05f);
            m.Doormat = Mat.Lit(ProceduralTextures.Linen(new Color(0.09f, 0.09f, 0.1f), 16, 0.05f), 0.02f);
            m.GreyFurniture = Mat.Lit(C(0x6d6862), 0.45f);
            m.Anthracite = Mat.Lit(C(0x4a4d52), 0.38f, 0.05f);
            m.BlackMatte = Mat.Lit(C(0x141416), 0.5f);
            m.BlackMetal = Mat.Lit(C(0x18181a), 0.65f, 0.8f);
            m.Steel = Mat.Lit(C(0xc9cbcf), 0.6f, 1f);
            m.Chrome = Mat.Lit(C(0xf2f2f2), 0.94f, 1f);
            m.WhitePlastic = Mat.Lit(C(0xf3f3f1), 0.65f);
            m.WhiteGloss = Mat.Lit(C(0xf1eee8), 0.88f);
            m.Ceramic = Mat.Lit(C(0xfbfbfb), 0.9f);
            m.Glass = Mat.Transparent(new Color(0.87f, 0.91f, 0.93f, 0.12f), 0.97f);
            m.GlassShower = Mat.Transparent(new Color(0.93f, 0.96f, 0.96f, 0.1f), 0.97f);
            m.Curtain = Mat.Transparent(new Color(1, 1, 1, 1), 0.05f, ProceduralTextures.Sheer());
            m.Grass = Mat.Lit(ProceduralTextures.Grass(), 0.08f);
            m.Ivy = Mat.Lit(ProceduralTextures.Ivy(), 0.2f);
            m.Rattan = Mat.Lit(ProceduralTextures.Rattan(), 0.15f);
            m.Awning = Mat.Lit(ProceduralTextures.Awning(), 0.1f);
            m.WaterNormal = ProceduralTextures.WaterNormals();
            m.Water = Mat.Transparent(new Color(0.5f, 0.83f, 0.9f, 0.82f), 0.96f);
            m.Water.SetTexture("_BumpMap", m.WaterNormal);
            m.Water.SetTextureScale("_BumpMap", new Vector2(0.8f, 0.8f));
            m.Water.SetFloat("_BumpScale", 0.35f);
            m.Water.EnableKeyword("_NORMALMAP");
            m.JacuzziShell = Mat.Lit(C(0x1b1c1f), 0.55f);
            m.JacuzziLiner = Mat.Lit(C(0xd8e4e8), 0.5f);
            m.Ground = Mat.Lit(C(0x9a968e), 0.05f);
            m.LeafBanana = Mat.Cutout(ProceduralTextures.Leaf(true, 1));
            m.LeafPalm = Mat.Cutout(ProceduralTextures.Leaf(false, 2));
            m.Trunk = Mat.Lit(C(0x6b5641), 0.1f);
            m.Mirror = Mat.Lit(Color.white, 0.98f, 1f);
            m.ScreenTv = Mat.Emissive(Color.white, 0f, ProceduralTextures.TvScreen());
            m.ScreenTv.SetFloat(Mat.Urp ? "_Smoothness" : "_Glossiness", 0.92f);
            m.LampDiffuser = Mat.Lit(Color.white, 0.4f);
            m.LampDiffuser.EnableKeyword("_EMISSION");
            m.Red = Mat.Lit(C(0x9b1d22), 0.1f);
            m.BlueTowel = Mat.Lit(C(0x1d6fb8), 0.05f);
            return m;
        }
    }
}

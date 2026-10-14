using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace Appartement.EditorTools
{
    /// <summary>
    /// Prépare le projet : scène « Appartement » (ajoutée aux Build Settings) et matériau
    /// de référence dans Resources pour que le shader PBR soit inclus dans les builds.
    /// S'exécute automatiquement à la première ouverture du projet, et via le menu « Appartement 3D ».
    /// </summary>
    [InitializeOnLoad]
    public static class AppartementMenu
    {
        const string ScenePath = "Assets/Appartement/Appartement.unity";
        const string MaterialPath = "Assets/Appartement/Resources/AppartementLit.mat";

        static AppartementMenu()
        {
            EditorApplication.delayCall += () =>
            {
                if (EditorApplication.isPlayingOrWillChangePlaymode) return;
                if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null) Setup(false);
            };
        }

        [MenuItem("Appartement 3D/Préparer le projet (scène + matériaux)")]
        static void SetupMenu() { Setup(true); }

        [MenuItem("Appartement 3D/Ouvrir la scène et jouer")]
        static void OpenAndPlay()
        {
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null) Setup(false);
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            EditorSceneManager.OpenScene(ScenePath);
            EditorApplication.isPlaying = true;
        }

        static void Setup(bool interactive)
        {
            // 1. Matériau de référence (garantit l'inclusion du shader Lit / Standard dans les builds)
            if (!AssetDatabase.IsValidFolder("Assets/Appartement/Resources")) AssetDatabase.CreateFolder("Assets/Appartement", "Resources");
            var urp = GraphicsSettings.currentRenderPipeline != null;
            var shader = urp ? Shader.Find("Universal Render Pipeline/Lit") : Shader.Find("Standard");
            var existing = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (shader != null && (existing == null || existing.shader != shader))
            {
                if (existing != null) AssetDatabase.DeleteAsset(MaterialPath);
                AssetDatabase.CreateAsset(new Material(shader), MaterialPath);
            }

            // 2. Scène dédiée, ajoutée en tête des Build Settings
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) == null)
            {
                if (interactive && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
                var previous = EditorSceneManager.GetActiveScene().path;
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                new GameObject("Appartement 3D").AddComponent<AppartementGame>();
                EditorSceneManager.SaveScene(scene, ScenePath);
                if (!interactive && !string.IsNullOrEmpty(previous)) EditorSceneManager.OpenScene(previous);
            }
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
            Debug.Log("Appartement 3D : projet prêt. Ouvrez Assets/Appartement/Appartement.unity puis appuyez sur Play.");
            if (interactive) EditorUtility.DisplayDialog("Appartement 3D", "Projet prêt.\n\nOuvrez la scène Assets/Appartement/Appartement.unity puis appuyez sur Play.", "OK");
        }
    }
}

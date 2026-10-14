using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Appartement
{
    /// <summary>
    /// Point d'entrée : construit l'appartement au lancement, crée le joueur et l'interface,
    /// gère les états (accueil / jeu / pause) et les raccourcis clavier.
    /// Ajouté automatiquement aux scènes « Appartement » et « SampleScene » (voir <see cref="AutoStart"/>),
    /// ou à placer sur un GameObject vide de n'importe quelle scène.
    /// </summary>
    public class AppartementGame : MonoBehaviour
    {
        public PlayerController Player { get; private set; }
        public EnvironmentController Env { get; private set; }
        public SoundFx Sound { get; private set; }
        public GameUI UI { get; private set; }

        Builder builder;
        PostFX postFx;
        string currentZone = "";
        float exposure;
        bool ready;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoStart()
        {
            var scene = SceneManager.GetActiveScene().name;
            if (scene != "Appartement" && scene != "SampleScene") return;
            if (FindObjectOfType<AppartementGame>() != null) return;
            new GameObject("Appartement 3D").AddComponent<AppartementGame>();
        }

        IEnumerator Start()
        {
            // Une scène de modèle (URP / 3D) contient déjà une caméra et une lumière : on les neutralise.
            foreach (var cam in FindObjectsOfType<Camera>()) cam.gameObject.SetActive(false);
            foreach (var l in FindObjectsOfType<Light>()) if (l.type == LightType.Directional) l.gameObject.SetActive(false);

            UI = gameObject.AddComponent<GameUI>();
            UI.Game = this;
            UI.enabled = false;
            yield return null;

            var t0 = Time.realtimeSinceStartup;
            var materials = Materials.Create();
            // Le décor est construit dans le repère du plan (Z = sud), puis la racine est retournée
            // en Z pour que la scène soit dans le bon sens (nord vers +Z monde).
            var root = new GameObject("Appartement (plan)").transform;
            Sound = gameObject.AddComponent<SoundFx>();
            Sound.Enabled = PlayerPrefs.GetInt("appart3d.sound", 1) == 1;
            builder = new Builder(materials, root) { Sound = Sound, Notify = s => UI.Toast(s) };
            Architecture.Build(builder);
            Interior.Build(builder);
            GardenBuilder.Build(builder);
            MirroredColliders.Create(root);
            root.localScale = new Vector3(1, 1, -1);

            Env = new GameObject("Environnement").AddComponent<EnvironmentController>();
            Env.Init(builder);
            builder.DirtyReflections = Env.RefreshReflections;

            var playerGo = new GameObject("Joueur");
            playerGo.AddComponent<CharacterController>();
            Player = playerGo.AddComponent<PlayerController>();
            Player.Sound = Sound;
            Player.Init(Layout.ToWorld(Layout.Spawn), -Layout.SpawnYaw * Mathf.Rad2Deg);
            Player.Sensitivity = PlayerPrefs.GetFloat("appart3d.sens", 1f);
            Player.WalkSpeed = PlayerPrefs.GetFloat("appart3d.speed", 1.55f);
            Player.InvertY = PlayerPrefs.GetInt("appart3d.invert", 0) == 1;
            postFx = PostFX.Setup(Player.Cam);

            foreach (var g in builder.Lights.Values) g.Update(1f, 0f);
            Env.RefreshReflections();
            Debug.Log($"Appartement 3D construit en {(Time.realtimeSinceStartup - t0):0.00} s.");
            ready = true;
            UI.enabled = true;
            ShowStart();
        }

        void ShowStart()
        {
            UI.Current = GameUI.State.Start;
            Player.InputEnabled = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        public void Play()
        {
            UI.Current = GameUI.State.Playing;
            Player.InputEnabled = true;
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            Sound.Click();
        }

        public void Pause()
        {
            UI.Current = GameUI.State.Paused;
            Player.InputEnabled = false;
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            SaveSettings();
        }

        public void ResetPlayer() { Player.ResetToSpawn(); UI.Toast("Retour au point de départ"); }

        public void ToggleNight()
        {
            Env.SetNight(!Env.Night);
            UI.Toast(Env.Night ? "Mode nuit" : "Mode jour");
        }

        public void ToggleFullscreen()
        {
            Screen.fullScreen = !Screen.fullScreen;
        }

        public void Quit()
        {
            SaveSettings();
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        void SaveSettings()
        {
            PlayerPrefs.SetFloat("appart3d.sens", Player.Sensitivity);
            PlayerPrefs.SetFloat("appart3d.speed", Player.WalkSpeed);
            PlayerPrefs.SetInt("appart3d.invert", Player.InvertY ? 1 : 0);
            PlayerPrefs.SetInt("appart3d.sound", Sound.Enabled ? 1 : 0);
            PlayerPrefs.Save();
        }

        void Update()
        {
            if (!ready) return;
            float dt = Mathf.Min(Time.deltaTime, 0.05f), time = Time.time;
            foreach (var u in builder.Updaters) u(dt, time);
            foreach (var g in builder.Lights.Values) g.Update(dt, time);

            if (UI.Current == GameUI.State.Playing)
            {
                if (GameInput.Pressed(Act.Menu)) { Pause(); return; }
                // Le navigateur / l'éditeur peuvent libérer la souris (Échap, perte de focus) : on passe en pause.
                if (Cursor.lockState != CursorLockMode.Locked && Application.isFocused) { Pause(); return; }
                if (GameInput.Pressed(Act.Interact) || GameInput.Click) Player.TryInteract();
                if (GameInput.Pressed(Act.Reset)) ResetPlayer();
                if (GameInput.Pressed(Act.Fullscreen)) ToggleFullscreen();
                if (GameInput.Pressed(Act.Help)) UI.ToggleHelp();
                if (GameInput.Pressed(Act.DayNight)) ToggleNight();
                if (GameInput.Pressed(Act.Flashlight)) { Player.ToggleFlashlight(); Sound.Click(); }
            }
            else if (UI.Current == GameUI.State.Paused && GameInput.Pressed(Act.Menu))
            {
                Play();
            }

            // Pièce courante + adaptation de l'œil (exposition intérieur / extérieur)
            var p = Player.PlanPosition;
            bool outdoor = false;
            if (Layout.ZoneAt(p.x, p.z, out var zone))
            {
                outdoor = zone.Outdoor;
                if (zone.Name != currentZone)
                {
                    currentZone = zone.Name;
                    if (UI.Current == GameUI.State.Playing) UI.Room(zone.Name);
                }
            }
            float nk = Env.NightFactor;
            float target = outdoor ? Mathf.Lerp(-0.5f, 0.3f, nk) : Mathf.Lerp(0.2f, 0.1f, nk);
            exposure = Mathf.Lerp(exposure, target, 1 - Mathf.Exp(-2.2f * dt));
            postFx?.SetExposure(exposure);
        }

        void OnApplicationQuit() { if (ready) SaveSettings(); }
    }
}

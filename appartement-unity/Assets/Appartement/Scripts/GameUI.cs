using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Interface discrète (IMGUI, aucune dépendance) : écran d'accueil, réticule, invite d'interaction,
    /// nom de la pièce, notifications, aide des commandes, menu pause avec réglages.
    /// </summary>
    public class GameUI : MonoBehaviour
    {
        public enum State { Start, Playing, Paused }
        public State Current = State.Start;
        public AppartementGame Game;

        string toast, room;
        float toastUntil, roomUntil;
        bool showHelp = true;
        GUIStyle title, body, small, prompt, roomStyle, box, button;
        Texture2D panelTex, dotTex, accentTex;
        static readonly Color Accent = new Color(1f, 0.71f, 0.41f);

        public void Toast(string msg) { toast = msg; toastUntil = Time.unscaledTime + 3.2f; }
        public void Room(string name) { room = name; roomUntil = Time.unscaledTime + 2.2f; }
        public void ToggleHelp() { showHelp = !showHelp; }

        static Texture2D Solid(Color c)
        {
            var t = new Texture2D(1, 1);
            t.SetPixel(0, 0, c);
            t.Apply();
            return t;
        }

        void Styles()
        {
            if (title != null) return;
            panelTex = Solid(new Color(0.07f, 0.07f, 0.09f, 0.86f));
            dotTex = Solid(Color.white);
            accentTex = Solid(Accent);
            title = new GUIStyle(GUI.skin.label) { fontSize = 30, fontStyle = FontStyle.Bold, wordWrap = true };
            title.normal.textColor = new Color(0.95f, 0.94f, 0.92f);
            body = new GUIStyle(GUI.skin.label) { fontSize = 15, wordWrap = true };
            body.normal.textColor = new Color(0.8f, 0.78f, 0.74f);
            small = new GUIStyle(body) { fontSize = 13 };
            prompt = new GUIStyle(GUI.skin.box) { fontSize = 15, alignment = TextAnchor.MiddleCenter, padding = new RectOffset(14, 14, 7, 7) };
            prompt.normal.background = panelTex;
            prompt.normal.textColor = Color.white;
            roomStyle = new GUIStyle(GUI.skin.label) { fontSize = 26, alignment = TextAnchor.MiddleCenter };
            roomStyle.normal.textColor = Color.white;
            box = new GUIStyle(GUI.skin.box) { padding = new RectOffset(24, 24, 22, 22) };
            box.normal.background = panelTex;
            button = new GUIStyle(GUI.skin.button) { fontSize = 15, fixedHeight = 36 };
        }

        void OnGUI()
        {
            Styles();
            float w = Screen.width, h = Screen.height;
            switch (Current)
            {
                case State.Start: StartScreen(w, h); break;
                case State.Playing: Hud(w, h); break;
                case State.Paused: Hud(w, h); PauseMenu(w, h); break;
            }
        }

        void StartScreen(float w, float h)
        {
            float pw = Mathf.Min(520, w - 32), ph = 400;
            GUILayout.BeginArea(new Rect((w - pw) / 2, (h - ph) / 2, pw, ph), box);
            var eyebrow = new GUIStyle(small);
            eyebrow.normal.textColor = Accent;
            GUILayout.Label("VISITE LIBRE À LA PREMIÈRE PERSONNE", eyebrow);
            GUILayout.Label("Studio & jardin spa", title);
            GUILayout.Label("Chambre-séjour, kitchenette, salle de bain en marbre et jardin privatif avec spa, reconstruits en 3D d'après les photos.", body);
            GUILayout.Space(14);
            var start = new GUIStyle(button) { fontSize = 17, fontStyle = FontStyle.Bold, fixedHeight = 46 };
            start.normal.background = accentTex;
            start.hover.background = accentTex;
            start.normal.textColor = new Color(0.1f, 0.07f, 0.02f);
            start.hover.textColor = start.normal.textColor;
            if (GUILayout.Button("Explorer l'appartement", start)) Game.Play();
            GUILayout.Space(12);
            GUILayout.Label("ZQSD / WASD : se déplacer   ·   Souris : regarder\nE ou clic : interagir   ·   Maj : courir   ·   Espace : sauter\nR : départ   ·   N : jour/nuit   ·   L : lampe   ·   F : plein écran\nH : aide   ·   Échap : menu", small);
            GUILayout.EndArea();
        }

        void Hud(float w, float h)
        {
            var target = Game.Player.Target;
            // Réticule
            float s = target != null ? 10 : 6;
            GUI.color = target != null ? Accent : new Color(1, 1, 1, 0.85f);
            GUI.DrawTexture(new Rect(w / 2 - s / 2, h / 2 - s / 2, s, s), dotTex);
            GUI.color = Color.white;
            if (target != null && Current == State.Playing)
            {
                var text = "[E]  " + target.Label();
                var size = prompt.CalcSize(new GUIContent(text));
                GUI.Label(new Rect(w / 2 - size.x / 2, h / 2 + 22, size.x, size.y), text, prompt);
            }
            if (room != null && Time.unscaledTime < roomUntil)
            {
                GUI.color = new Color(1, 1, 1, Mathf.Clamp01((roomUntil - Time.unscaledTime) / 0.6f));
                GUI.Label(new Rect(0, h * 0.16f, w, 40), room.ToUpperInvariant(), roomStyle);
                GUI.color = Color.white;
            }
            if (toast != null && Time.unscaledTime < toastUntil)
            {
                var size = prompt.CalcSize(new GUIContent(toast));
                float tw = Mathf.Min(size.x, w - 32);
                GUI.Label(new Rect(w / 2 - tw / 2, h - 70, tw, size.y), toast, prompt);
            }
            if (showHelp && Current == State.Playing)
            {
                GUILayout.BeginArea(new Rect(16, h - 150, 300, 134), box);
                GUILayout.Label("ZQSD déplacement · Maj courir · Espace sauter\nE interagir · R départ · N jour/nuit\nL lampe · F plein écran · H aide · Échap menu", small);
                GUILayout.EndArea();
            }
        }

        void PauseMenu(float w, float h)
        {
            float pw = Mathf.Min(460, w - 32), ph = 470;
            GUILayout.BeginArea(new Rect((w - pw) / 2, (h - ph) / 2, pw, ph), box);
            GUILayout.Label("Pause", title);
            if (GUILayout.Button("Reprendre l'exploration", button)) Game.Play();
            GUILayout.Space(10);
            var p = Game.Player;
            GUILayout.Label($"Sensibilité de la souris : {p.Sensitivity:0.00}×", body);
            p.Sensitivity = GUILayout.HorizontalSlider(p.Sensitivity, 0.2f, 3f);
            GUILayout.Space(8);
            GUILayout.Label($"Vitesse de marche : {p.WalkSpeed * 3.6f:0.0} km/h", body);
            p.WalkSpeed = GUILayout.HorizontalSlider(p.WalkSpeed, 0.8f, 3f);
            GUILayout.Space(10);
            p.InvertY = GUILayout.Toggle(p.InvertY, " Inverser l'axe vertical");
            showHelp = GUILayout.Toggle(showHelp, " Afficher les commandes");
            Game.Sound.Enabled = GUILayout.Toggle(Game.Sound.Enabled, " Sons");
            GUILayout.Space(10);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(Game.Env.Night ? "Passer en mode jour" : "Passer en mode nuit", button)) Game.ToggleNight();
            if (GUILayout.Button("Revenir au départ", button)) { Game.ResetPlayer(); Game.Play(); }
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(Screen.fullScreen ? "Quitter le plein écran" : "Plein écran", button)) Game.ToggleFullscreen();
            if (GUILayout.Button("Quitter", button)) Game.Quit();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }
    }
}

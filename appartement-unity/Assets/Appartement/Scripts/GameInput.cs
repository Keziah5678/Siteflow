using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Appartement
{
    public enum Act { Interact, Reset, Fullscreen, Help, DayNight, Flashlight, Menu, Jump }

    /// <summary>
    /// Entrées clavier/souris compatibles avec le nouveau Input System (si actif dans le projet)
    /// et l'ancien Input Manager. ZQSD (AZERTY) et WASD (QWERTY) fonctionnent tous les deux.
    /// </summary>
    public static class GameInput
    {
#if ENABLE_INPUT_SYSTEM
        // Le nouveau système lit les touches par position physique :
        // la touche « W » d'un clavier QWERTY est le « Z » d'un clavier AZERTY.
        static bool Held(Key k) { var kb = Keyboard.current; return kb != null && kb[k].isPressed; }
        static bool Down(Key k) { var kb = Keyboard.current; return kb != null && kb[k].wasPressedThisFrame; }

        public static Vector2 Move()
        {
            float f = (Held(Key.W) || Held(Key.UpArrow) ? 1 : 0) - (Held(Key.S) || Held(Key.DownArrow) ? 1 : 0);
            float s = (Held(Key.D) || Held(Key.RightArrow) ? 1 : 0) - (Held(Key.A) || Held(Key.LeftArrow) ? 1 : 0);
            return new Vector2(s, f);
        }

        public static bool Run => Held(Key.LeftShift) || Held(Key.RightShift);

        public static Vector2 LookDelta()
        {
            var m = Mouse.current;
            return m == null ? Vector2.zero : m.delta.ReadValue();
        }

        public static bool Click => Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame;

        public static bool Pressed(Act a)
        {
            switch (a)
            {
                case Act.Interact: return Down(Key.E);
                case Act.Reset: return Down(Key.R);
                case Act.Fullscreen: return Down(Key.F);
                case Act.Help: return Down(Key.H);
                case Act.DayNight: return Down(Key.N);
                case Act.Flashlight: return Down(Key.L);
                case Act.Menu: return Down(Key.Escape);
                case Act.Jump: return Down(Key.Space);
            }
            return false;
        }
#else
        public static Vector2 Move()
        {
            bool fwd = Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.Z) || Input.GetKey(KeyCode.UpArrow);
            bool back = Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow);
            bool left = Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.Q) || Input.GetKey(KeyCode.LeftArrow);
            bool right = Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow);
            return new Vector2((right ? 1 : 0) - (left ? 1 : 0), (fwd ? 1 : 0) - (back ? 1 : 0));
        }

        public static bool Run => Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);

        // L'ancien Input Manager renvoie environ un dixième du déplacement en pixels.
        public static Vector2 LookDelta() { return new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y")) * 10f; }

        public static bool Click => Input.GetMouseButtonDown(0);

        public static bool Pressed(Act a)
        {
            switch (a)
            {
                case Act.Interact: return Input.GetKeyDown(KeyCode.E);
                case Act.Reset: return Input.GetKeyDown(KeyCode.R);
                case Act.Fullscreen: return Input.GetKeyDown(KeyCode.F);
                case Act.Help: return Input.GetKeyDown(KeyCode.H);
                case Act.DayNight: return Input.GetKeyDown(KeyCode.N);
                case Act.Flashlight: return Input.GetKeyDown(KeyCode.L);
                case Act.Menu: return Input.GetKeyDown(KeyCode.Escape);
                case Act.Jump: return Input.GetKeyDown(KeyCode.Space);
            }
            return false;
        }
#endif
    }
}

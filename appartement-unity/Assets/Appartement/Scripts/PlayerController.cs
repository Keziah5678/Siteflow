using UnityEngine;

namespace Appartement
{
    /// <summary>
    /// Contrôleur à la première personne : CharacterController (collisions, marches, pentes),
    /// accélération/décélération douces, gravité, saut, course, balancement de tête,
    /// réticule d'interaction et lampe torche.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        public float WalkSpeed = 1.55f;      // m/s, réglable dans le menu
        public float RunMultiplier = 1.9f;
        public float Sensitivity = 1f;        // multiplicateur, réglable
        public bool InvertY;
        public float EyeHeight = 1.62f;
        public bool InputEnabled;

        public Camera Cam { get; private set; }
        public Interactable Target { get; private set; }
        public SoundFx Sound;

        CharacterController cc;
        Vector3 velocity;
        float yaw, pitch, bobPhase, bobAmount, stepTimer, eyeY;
        Vector3 spawnPos;
        float spawnYaw;
        Light flashlight;

        public void Init(Vector3 worldSpawn, float spawnYawDeg)
        {
            spawnPos = worldSpawn;
            spawnYaw = spawnYawDeg;
            cc = GetComponent<CharacterController>();
            cc.height = 1.78f;
            cc.radius = 0.24f;
            cc.center = new Vector3(0, 0.89f, 0);
            cc.stepOffset = 0.2f;
            cc.slopeLimit = 45f;
            cc.skinWidth = 0.02f;
            cc.minMoveDistance = 0f;

            var camGo = new GameObject("Caméra joueur");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(transform, false);
            Cam = camGo.AddComponent<Camera>();
            Cam.fieldOfView = 72f;
            Cam.nearClipPlane = 0.04f;
            Cam.farClipPlane = 400f;
            Cam.allowHDR = true;
            camGo.AddComponent<AudioListener>();

            var fl = new GameObject("Lampe torche");
            fl.transform.SetParent(camGo.transform, false);
            fl.transform.localPosition = new Vector3(0.15f, -0.15f, 0);
            flashlight = fl.AddComponent<Light>();
            flashlight.type = LightType.Spot;
            flashlight.spotAngle = 50f;
            flashlight.range = 12f;
            flashlight.intensity = 2.5f;
            flashlight.color = new Color(1f, 0.96f, 0.88f);
            flashlight.enabled = false;
            ResetToSpawn();
        }

        public void ResetToSpawn()
        {
            cc.enabled = false;
            transform.position = spawnPos;
            cc.enabled = true;
            velocity = Vector3.zero;
            yaw = spawnYaw;
            pitch = -3f;
            eyeY = EyeHeight;
            Apply(0);
        }

        public void ToggleFlashlight() { flashlight.enabled = !flashlight.enabled; }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (InputEnabled)
            {
                var look = GameInput.LookDelta() * (0.12f * Sensitivity);
                yaw += look.x;
                pitch += look.y * (InvertY ? -1 : 1);
                pitch = Mathf.Clamp(pitch, -86f, 86f);
            }

            // Déplacement horizontal avec accélération / décélération légères
            var axes = InputEnabled ? Vector2.ClampMagnitude(GameInput.Move(), 1f) : Vector2.zero;
            bool running = InputEnabled && GameInput.Run;
            float speed = WalkSpeed * (running ? RunMultiplier : 1f);
            var rot = Quaternion.Euler(0, yaw, 0);
            var wish = rot * new Vector3(axes.x, 0, axes.y) * speed;
            bool grounded = cc.isGrounded;
            float accel = axes.sqrMagnitude > 0.0001f ? (grounded ? 9f : 2.5f) : (grounded ? 11f : 1.5f);
            float a = 1 - Mathf.Exp(-accel * dt);
            velocity.x = Mathf.Lerp(velocity.x, wish.x, a);
            velocity.z = Mathf.Lerp(velocity.z, wish.z, a);

            // Gravité et saut
            if (grounded && velocity.y < 0) velocity.y = -1f;
            if (InputEnabled && grounded && GameInput.Pressed(Act.Jump)) velocity.y = 3.1f;
            velocity.y -= 9.81f * dt;

            var before = transform.position;
            cc.Move(velocity * dt);
            // La vitesse réelle tient compte des collisions (glissement le long des murs)
            if (dt > 0)
            {
                var real = (transform.position - before) / dt;
                if (Mathf.Abs(real.x) < Mathf.Abs(velocity.x)) velocity.x = real.x;
                if (Mathf.Abs(real.z) < Mathf.Abs(velocity.z)) velocity.z = real.z;
            }

            // Sécurité : jamais sous le sol ni hors de la scène
            if (transform.position.y < -3f) ResetToSpawn();

            // Balancement de tête et bruits de pas
            float hs = new Vector2(velocity.x, velocity.z).magnitude;
            bool moving = cc.isGrounded && hs > 0.2f;
            bobAmount = Mathf.Lerp(bobAmount, moving ? Mathf.Min(1, hs / 2.2f) : 0, 1 - Mathf.Exp(-8 * dt));
            if (moving)
            {
                bobPhase += dt * (5.5f + hs * 2.2f);
                stepTimer += dt * hs;
                if (stepTimer > 0.72f) { stepTimer = 0; if (Sound != null) Sound.Step(); }
            }
            Apply(dt);
            UpdateTarget();
        }

        void Apply(float dt)
        {
            eyeY = dt > 0 ? Mathf.Lerp(eyeY, EyeHeight, 1 - Mathf.Exp(-18 * dt)) : EyeHeight;
            float bob = Mathf.Sin(bobPhase * 2) * 0.022f * bobAmount;
            float sway = Mathf.Cos(bobPhase) * 0.012f * bobAmount;
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            Cam.transform.localPosition = new Vector3(sway, eyeY + bob, 0);
            Cam.transform.localRotation = Quaternion.Euler(-pitch, 0, 0);
        }

        /// <summary>Rayon depuis le centre de l'écran : le premier objet touché masque ce qui est derrière.</summary>
        void UpdateTarget()
        {
            Target = null;
            if (!InputEnabled) return;
            var ray = new Ray(Cam.transform.position, Cam.transform.forward);
            if (Physics.Raycast(ray, out var hit, 3.5f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Collide))
            {
                var src = hit.collider.GetComponent<ColliderSource>();
                var go = src != null && src.Source != null ? src.Source : hit.collider.gameObject;
                var it = go.GetComponentInParent<Interactable>();
                if (it != null && hit.distance <= it.Range) Target = it;
            }
        }

        public bool TryInteract()
        {
            if (Target == null) return false;
            Target.Action();
            return true;
        }

        public Vector3 PlanPosition => Layout.ToPlan(transform.position);
    }
}

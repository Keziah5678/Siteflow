using UnityEngine;

namespace Appartement
{
    /// <summary>Petits sons synthétisés au lancement (aucun fichier audio).</summary>
    public class SoundFx : MonoBehaviour
    {
        AudioSource src;
        AudioClip click, door, slide, step, beep;
        public bool Enabled = true;

        void Awake()
        {
            src = gameObject.AddComponent<AudioSource>();
            src.spatialBlend = 0f;
            click = Noise("click", 0.04f, 0.35f, 0.9f);
            door = Noise("door", 0.5f, 0.25f, 0.08f);
            slide = Noise("slide", 0.7f, 0.12f, 0.25f);
            step = Noise("step", 0.07f, 0.18f, 0.05f);
            beep = Tone("beep", 1760f, 0.15f, 0.06f);
        }

        /// <summary>Bruit filtré (passe-bas simple) avec enveloppe décroissante.</summary>
        static AudioClip Noise(string name, float dur, float gain, float bright)
        {
            int rate = 44100, n = Mathf.CeilToInt(rate * dur);
            var data = new float[n];
            var r = new System.Random(name.GetHashCode());
            float y = 0;
            for (int i = 0; i < n; i++)
            {
                float x = (float)(r.NextDouble() * 2 - 1);
                y += (x - y) * bright;
                float env = Mathf.Pow(1 - (float)i / n, 2);
                data[i] = y * env * gain * 3f;
            }
            var clip = AudioClip.Create(name, n, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }

        static AudioClip Tone(string name, float freq, float dur, float gain)
        {
            int rate = 44100, n = Mathf.CeilToInt(rate * dur);
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = Mathf.Sin(2 * Mathf.PI * freq * i / rate) * gain * Mathf.Exp(-i * 30f / n);
            var clip = AudioClip.Create(name, n, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }

        void Play(AudioClip c, float pitch = 1f)
        {
            if (!Enabled || src == null || c == null) return;
            src.pitch = pitch;
            src.PlayOneShot(c);
        }

        public void Click() { Play(click); }
        public void Door() { Play(door); }
        public void Slide() { Play(slide); }
        public void Step() { Play(step, Random.Range(0.85f, 1.15f)); }
        public void Beep() { Play(beep); }
    }
}

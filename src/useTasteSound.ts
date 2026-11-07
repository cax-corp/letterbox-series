import { useEffect, useRef, useState } from "react";

type Cue = "launch" | "step" | "ready" | "select";
const preferenceKey = "vela-taste-sound-v1";
// Short, synthesized cues only. No audio assets, microphone, ambient loop or network.
export function useTasteSound() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) !== "off";
    } catch {
      return true;
    }
  });
  const [unavailable, setUnavailable] = useState(false);
  const wanted = useRef(enabled);
  const context = useRef<AudioContext | null>(null);
  const voice = useRef<GainNode | null>(null);
  const mounted = useRef(true);
  const stop = () => {
    const old = context.current;
    context.current = null;
    voice.current = null;
    if (old && old.state !== "closed") void old.close().catch(() => {});
  };
  useEffect(() => {
    mounted.current = true;
    const quiet = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", quiet);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", quiet);
      stop();
    };
  }, []);
  function toggle() {
    wanted.current = !wanted.current;
    setEnabled(wanted.current);
    try {
      localStorage.setItem(preferenceKey, wanted.current ? "on" : "off");
    } catch {}
    if (!wanted.current) stop();
  }
  function play(cue: Cue, gesture = false) {
    if (!wanted.current || document.hidden || !mounted.current) return;
    try {
      if (!context.current) {
        // The first context is created only by a deliberate click, never on page load.
        if (!gesture) return;
        const Constructor =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Constructor) {
          setUnavailable(true);
          return;
        }
        const audio = new Constructor();
        context.current = audio;
        const gain = audio.createGain();
        gain.gain.value = 0.075;
        gain.connect(audio.destination);
        voice.current = gain;
      }
      const audio = context.current,
        master = voice.current!;
      const emit = () => {
        if (
          audio !== context.current ||
          !wanted.current ||
          document.hidden ||
          audio.state !== "running"
        )
          return;
        const notes =
          cue === "launch"
            ? [164.81, 329.63, 493.88]
            : cue === "ready"
              ? [329.63, 493.88, 659.25]
              : cue === "step"
                ? [880, 1108.73]
                : [554.37, 830.61];
        notes.forEach((frequency, i) => {
          const start =
            audio.currentTime + i * (cue === "step" ? 0.025 : 0.095);
          const duration = cue === "launch" || cue === "ready" ? 0.27 : 0.075;
          const oscillator = audio.createOscillator(),
            envelope = audio.createGain();
          oscillator.type = cue === "step" ? "sine" : "triangle";
          oscillator.frequency.setValueAtTime(frequency * 0.88, start);
          oscillator.frequency.exponentialRampToValueAtTime(
            frequency,
            start + 0.035,
          );
          envelope.gain.setValueAtTime(0, start);
          envelope.gain.linearRampToValueAtTime(0.4, start + 0.009);
          envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
          oscillator.connect(envelope);
          envelope.connect(master);
          oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
          };
          oscillator.start(start);
          oscillator.stop(start + duration + 0.01);
        });
      };
      if (audio.state === "suspended") {
        if (gesture)
          void audio
            .resume()
            .then(emit)
            .catch(() => {
              if (mounted.current) setUnavailable(true);
            });
      } else emit();
    } catch {
      stop();
      if (mounted.current) setUnavailable(true);
    }
  }
  return { enabled, unavailable, toggle, play };
}

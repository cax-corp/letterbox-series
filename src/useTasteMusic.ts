import { useEffect, useRef, useState } from "react";

// Stream through the browser's media decoder, rather than decoding a whole WAV
// into the 3D scene's memory. The same local asset is bundled in Android.
export function useTasteMusic() {
  const [blocked, setBlocked] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const active = useRef(false),
    enabled = useRef(false),
    alive = useRef(true);
  const suspended = useRef(false),
    attempt = useRef(0);
  const canPlay = () =>
    alive.current &&
    active.current &&
    enabled.current &&
    !document.hidden &&
    !suspended.current;

  function pause() {
    attempt.current++;
    player.current?.pause();
  }
  function play() {
    if (!canPlay()) return;
    try {
      if (!player.current) {
        const audio = new Audio();
        audio.preload = "none";
        audio.loop = true;
        audio.volume = 0.4;
        audio.setAttribute("playsinline", "");
        audio.src = new URL(
          `${import.meta.env.BASE_URL}audio/spacewalk.mp3`,
          document.baseURI,
        ).href;
        player.current = audio;
      }
      const audio = player.current,
        token = ++attempt.current;
      void audio
        .play()
        .then(() => {
          if (!canPlay() || player.current !== audio) audio.pause();
          else if (token === attempt.current) {
            setBlocked(false);
            setUnavailable(false);
          }
        })
        .catch((error: unknown) => {
          if (
            !alive.current ||
            token !== attempt.current ||
            player.current !== audio
          )
            return;
          if (error instanceof Error && error.name === "AbortError") return;
          if (error instanceof Error && error.name === "NotAllowedError")
            setBlocked(true);
          else setUnavailable(true);
        });
    } catch {
      if (alive.current) setUnavailable(true);
    }
  }
  useEffect(() => {
    alive.current = true;
    const visibility = () => {
      if (document.hidden) pause();
      else play();
    };
    const sleep = () => {
      suspended.current = true;
      pause();
    };
    const wake = () => {
      suspended.current = false;
      play();
    };
    document.addEventListener("visibilitychange", visibility);
    // Cordova-compatible lifecycle events also cover native WebView suspension.
    document.addEventListener("pause", sleep);
    document.addEventListener("resume", wake);
    window.addEventListener("pagehide", sleep);
    window.addEventListener("pageshow", wake);
    return () => {
      alive.current = false;
      active.current = false;
      pause();
      const audio = player.current;
      player.current = null;
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pause", sleep);
      document.removeEventListener("resume", wake);
      window.removeEventListener("pagehide", sleep);
      window.removeEventListener("pageshow", wake);
    };
  }, []);
  return {
    blocked,
    unavailable,
    enter(on: boolean) {
      active.current = true;
      enabled.current = on;
      if (on) play();
    },
    setEnabled(on: boolean) {
      enabled.current = on;
      setBlocked(false);
      if (on) play();
      else pause();
    },
  };
}

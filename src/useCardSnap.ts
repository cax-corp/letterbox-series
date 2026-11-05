import { useEffect, useRef, type RefObject } from "react";
/** One wheel/keyboard gesture moves one card; native touch scrolling uses CSS snap-stop. */
export function useCardSnap(
  root: RefObject<HTMLDivElement | null>,
  step: number,
  count: number,
) {
  const metrics = useRef({ step, count });
  metrics.current = { step, count };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let wheelGesture = false;
    let release: ReturnType<typeof setTimeout> | undefined;
    let delta = 0;
    function move(direction: number) {
      const { step, count } = metrics.current;
      if (!count) return;
      const index = Math.max(
        0,
        Math.min(count - 1, Math.round(el!.scrollTop / step) + direction),
      );
      el!.scrollTo({
        top: index * step,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
    function wheel(event: WheelEvent) {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        !metrics.current.count
      )
        return;
      event.preventDefault();
      clearTimeout(release);
      release = setTimeout(() => {
        wheelGesture = false;
        delta = 0;
      }, 180);
      if (wheelGesture) return;
      delta +=
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el!.clientHeight
            : 1);
      if (Math.abs(delta) < 12) return;
      wheelGesture = true;
      move(delta > 0 ? 1 : -1);
    }
    function key(event: KeyboardEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest(
          "button,a,input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const direction =
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        (event.key === " " && !event.shiftKey)
          ? 1
          : event.key === "ArrowUp" ||
              event.key === "PageUp" ||
              (event.key === " " && event.shiftKey)
            ? -1
            : 0;
      if (direction) {
        event.preventDefault();
        move(direction);
      }
    }
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("keydown", key);
    return () => {
      clearTimeout(release);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
    };
  }, [root]);
}

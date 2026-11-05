import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/** Position drives both prefetch and ambience, without relying on a virtualized sentinel. */
export function useFeedMotion(
  root: RefObject<HTMLDivElement | null>,
  step: number,
  count: number,
) {
  const metrics = useRef({ step, count });
  metrics.current = { step, count };
  const [position, setPosition] = useState({
    index: 0,
    moving: false,
  });
  const refresh = useRef<() => void>(() => {});
  useLayoutEffect(() => refresh.current(), [step, count]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touching = false;
    let startY = 0;
    const publish = (moving?: boolean) => {
      const { step, count } = metrics.current;
      const index = Math.max(
        0,
        Math.min(count - 1, Math.round(el.scrollTop / step)),
      );
      setPosition((previous) => {
        const next = { index, moving: moving ?? previous.moving };
        return next.index === previous.index && next.moving === previous.moving
          ? previous
          : next;
      });
    };
    const settle = () => {
      if (!touching) publish(false);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 180);
    };
    const scroll = () => {
      publish(true);
      schedule();
    };
    const touchStart = (e: TouchEvent) => {
      touching = true;
      startY = e.touches[0]?.clientY ?? 0;
    };
    const touchMove = (e: TouchEvent) => {
      if (Math.abs((e.touches[0]?.clientY ?? startY) - startY) > 8)
        publish(true);
    };
    const touchEnd = () => {
      touching = false;
      schedule();
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        publish(true);
        schedule();
      }
    };
    refresh.current = () => publish();
    publish(false);
    el.addEventListener("scroll", scroll, { passive: true });
    el.addEventListener("scrollend", settle);
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchmove", touchMove, { passive: true });
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchEnd, { passive: true });
    el.addEventListener("wheel", wheel, { passive: true });
    return () => {
      clearTimeout(timer);
      refresh.current = () => {};
      el.removeEventListener("scroll", scroll);
      el.removeEventListener("scrollend", settle);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      el.removeEventListener("wheel", wheel);
    };
  }, [root]);
  return { ...position, nearEnd: count - position.index <= 4 };
}

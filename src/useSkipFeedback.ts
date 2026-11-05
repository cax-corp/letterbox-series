import { useLayoutEffect, useRef, type RefObject } from "react";
import { QuickSkipTracker, rememberQuickSkip } from "./implicit-feedback";
import type { Title } from "./catalog";
import type { Entry } from "./store";
type Props = {
  root: RefObject<HTMLDivElement | null>;
  title?: Title;
  index: number;
  moving: boolean;
  paused: boolean;
  account: string;
  library: Record<string, Entry>;
  changed: () => void;
};
export function useSkipFeedback(props: Props) {
  const tracker = useRef(new QuickSkipTracker()),
    latest = useRef(props);
  latest.current = props;
  const owner = useRef(props.account);
  if (owner.current !== props.account) {
    owner.current = props.account;
    tracker.current = new QuickSkipTracker();
  }
  const publish = () => {
    const p = latest.current;
    const skipped = tracker.current.update(
      p.title,
      p.index,
      p.moving,
      p.paused || document.hidden,
      performance.now(),
    );
    if (!skipped) return;
    const entry = p.library[skipped.title.id];
    if (
      entry &&
      (entry.favorite ||
        entry.rating > 0 ||
        entry.watchlist ||
        entry.watched ||
        entry.recommendationFeedback)
    )
      return;
    if (rememberQuickSkip(skipped.title, skipped.dwell, p.account)) p.changed();
  };
  useLayoutEffect(publish, [
    props.title?.id,
    props.index,
    props.moving,
    props.paused,
    props.account,
  ]);
  useLayoutEffect(() => {
    const el = props.root.current;
    if (!el) return;
    let touchY: number | null = null;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX))
        tracker.current.intent(e.deltaY > 0);
    };
    const touchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const touchMove = (e: TouchEvent) => {
      if (
        touchY !== null &&
        Math.abs((e.touches[0]?.clientY ?? touchY) - touchY) > 8
      )
        tracker.current.intent((e.touches[0]?.clientY ?? touchY) < touchY);
    };
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest("button,a,input,textarea,select")
      )
        return;
      if (["ArrowDown", "PageDown", " ", "ArrowUp", "PageUp"].includes(e.key))
        tracker.current.intent(
          ["ArrowDown", "PageDown", " "].includes(e.key) && !e.shiftKey,
        );
    };
    const engage = (e: Event) => {
      const id =
        e.target instanceof Element
          ? e.target.closest<HTMLElement>("[data-title-id]")?.dataset.titleId
          : null;
      if (
        id &&
        (e.type === "dblclick" ||
          (e.target instanceof Element && e.target.closest("button,a,input")))
      )
        tracker.current.engage(id);
    };
    const visibility = () => {
      if (document.hidden) tracker.current.suspend();
      else publish();
    };
    el.addEventListener("wheel", wheel, { passive: true });
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchmove", touchMove, { passive: true });
    el.addEventListener("keydown", key);
    el.addEventListener("click", engage, true);
    el.addEventListener("dblclick", engage, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      tracker.current.suspend();
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
      el.removeEventListener("keydown", key);
      el.removeEventListener("click", engage, true);
      el.removeEventListener("dblclick", engage, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [props.root, props.account]);
}

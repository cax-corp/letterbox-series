import React, { useEffect, useRef } from "react";
import { X } from "./icons";
export default function Modal({
  children,
  close,
  label,
  wide = false,
  style,
}: {
  children: React.ReactNode;
  close: () => void;
  label: string;
  wide?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={wide ? "modal-overlay details-overlay" : "modal-overlay"}
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
            return;
          }
          if (e.key !== "Tab") return;
          const list = ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input,textarea,select",
          );
          if (!list?.length) return;
          const first = list[0],
            last = list[list.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <button
          className="modal-close surface"
          aria-label="Fermer"
          onClick={close}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

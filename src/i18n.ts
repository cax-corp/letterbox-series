import { useSyncExternalStore } from "react";
import en from "./locales/en-US.json" with { type: "json" };
export type AppLanguage = "fr-FR" | "en-US";
export const languages: { code: AppLanguage; name: string }[] = [
  { code: "fr-FR", name: "Français" },
  { code: "en-US", name: "English (US)" },
];
export function validLanguage(value: unknown): value is AppLanguage {
  return value === "fr-FR" || value === "en-US";
}
const listeners = new Set<() => void>();
let language: AppLanguage = "fr-FR";
try {
  const saved = localStorage.getItem("vela-language-ui-v1");
  if (validLanguage(saved)) language = saved;
} catch {}
export function getLanguage() {
  return language;
}
export function setAppLanguage(value: AppLanguage) {
  if (!validLanguage(value)) return;
  const changed = language !== value;
  language = value;
  if (typeof document !== "undefined") {
    document.documentElement.lang = value;
    if (/^Vela — (Films et séries|Movies and TV shows)$/.test(document.title))
      document.title =
        value === "en-US"
          ? "Vela — Movies and TV shows"
          : "Vela — Films et séries";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        value === "en-US"
          ? "Vela — discover movies and TV shows, manage your collection and share your reviews."
          : "Vela — découvrez des films et des séries, gérez votre collection et partagez vos avis.",
      );
  }
  try {
    localStorage.setItem("vela-language-ui-v1", value);
  } catch {}
  if (changed) {
    listeners.forEach((fn) => fn());
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("vela-language-change"));
  }
}
export function useLanguage() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getLanguage,
    () => "fr-FR" as AppLanguage,
  );
}
/** Explicit application copy only. Never run on names, reviews, biographies or API prose. */
const english = en as Record<string, string>;
const reverse = new Map(Object.entries(english).map(([fr, us]) => [us, fr]));
const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(english)
  .filter(([fr]) => /\{\d+\}/.test(fr))
  .flatMap(([fr, us]) =>
    [fr, us].map((text) => {
      const parts = text.split(/(\{\d+\})/);
      const positions: number[] = [];
      return {
        fr,
        us,
        positions,
        re: new RegExp(
          "^" +
            parts
              .map((part) =>
                /^\{\d+\}$/.test(part)
                  ? (positions.push(Number(part.slice(1, -1))), "(.+?)")
                  : escape(part),
              )
              .join("") +
            "$",
        ),
      };
    }),
  );
export function t(source: string, ...values: unknown[]): string {
  const leading = source.match(/^\s*/)?.[0] || "",
    trailing = source.match(/\s*$/)?.[0] || "";
  const key = source.trim();
  let canonical = english[key] ? key : reverse.get(key) || key;
  if (!values.length && canonical === key && !english[key]) {
    for (const p of patterns) {
      const match = p.re.exec(key);
      if (match) {
        canonical = p.fr;
        values = [];
        p.positions.forEach((position, i) => {
          values[position] = match[i + 1];
        });
        break;
      }
    }
  }
  const template =
    language === "en-US" ? english[canonical] || canonical : canonical;
  return (
    leading +
    template.replace(/\{(\d+)\}/g, (_, n) => String(values[Number(n)] ?? "")) +
    trailing
  );
}
export function genreName(name: string) {
  return t(name);
}
if (typeof document !== "undefined") document.documentElement.lang = language;

export function recommendationReason(reason: string) {
  const liked = /^Parce que vous avez aimé « (.*) »$/.exec(reason);
  if (liked) return t("Parce que vous avez aimé « {0} »", liked[1]);
  const taste = /^Votre goût pour (.*)$/.exec(reason);
  if (taste) return t("Votre goût pour {0}", t(taste[1]));
  const mixed = /^Un croisement de (.*) et de (.*)$/.exec(reason);
  if (mixed)
    return t("Un croisement de {0} et de {1}", t(mixed[1]), t(mixed[2]));
  return t(reason);
}

import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import type { Title } from "./catalog";
import { profileDraft, reviewDraft, type ShareDraft } from "./public-sharing";
export { profileDraft as profileShare, reviewDraft as reviewShare };
export type { ShareDraft };
export type ShareOutcome = "shared" | "copied" | "cancelled";
const canonical = "https://vela.thomasbarial.com/";
export function webBaseUrl() {
  const override = import.meta.env?.VITE_PUBLIC_SITE_URL?.trim();
  if (override) {
    try {
      const u = new URL(override);
      if (u.protocol === "https:") {
        u.hash = "";
        u.search = "";
        return u.href.replace(/\/?$/, "/");
      }
    } catch {
      /* Fall back to the published website. */
    }
  }
  if (
    !Capacitor.isNativePlatform() &&
    typeof location !== "undefined" &&
    location.protocol === "https:"
  )
    return location.origin + location.pathname;
  return canonical;
}
export function publicTitleUrl(title: Pick<Title, "id">) {
  if (!/^(?:tmdb-)?(?:movie|series)-\d+$/.test(title.id))
    throw new Error("Titre non partageable.");
  return `${webBaseUrl()}#/title/${title.id}`;
}
export function sharedPageUrl(id: string) {
  return `${webBaseUrl()}#/s/${id}`;
}
export function titleShare(title: Title): ShareDraft {
  return {
    kind: "title",
    target: title.id,
    heading: title.name,
    text: `${title.name}${title.year ? ` (${title.year})` : ""} sur Vela`,
    url: publicTitleUrl(title),
  };
}
function cancelled(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /cancel|dismiss|annul/i.test(error.message))
  );
}
export async function copyShareLink(card: ShareDraft): Promise<ShareOutcome> {
  if (!card.url) throw new Error("Le lien n’est pas encore prêt.");
  await Clipboard.write({ string: card.url });
  return "copied";
}
/** Called by a click: no image decoding, font loading or network preparation. */
export async function shareCard(card: ShareDraft): Promise<ShareOutcome> {
  if (!card.url) throw new Error("Le lien n’est pas encore prêt.");
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: card.heading,
        text: card.text,
        url: card.url,
        dialogTitle: "Partager le lien Vela",
      });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
      return copyShareLink(card);
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({
        title: card.heading,
        text: card.text,
        url: card.url,
      });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
    }
  }
  return copyShareLink(card);
}
export function shareMessage(outcome: ShareOutcome) {
  return outcome === "shared"
    ? "Le partage est ouvert."
    : outcome === "copied"
      ? "Lien copié. Collez-le dans l’application de votre choix."
      : "Partage annulé.";
}

import { Capacitor, registerPlugin } from "@capacitor/core";
import { t as tr } from "./i18n";

interface StoriesPlugin {
  share(options: {
    png: string;
    target: "instagram" | "share";
  }): Promise<{ destination: string }>;
  save(options: { png: string }): Promise<{ saved: boolean }>;
}
const Stories = registerPlugin<StoriesPlugin>("VelaStories");
export function storyFilename(name: string) {
  return `Vela-${
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, 70) || "story"
  }.png`;
}
export function storyBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () =>
      reject(new Error(tr("Impossible de préparer le visuel.")));
    reader.readAsDataURL(blob);
  });
}
export function downloadStory(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function supportsStoryShare(file: File) {
  return (
    Capacitor.isNativePlatform() ||
    Boolean(
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [file] }),
    )
  );
}
export async function sendStory(file: File, png: string, instagram = false) {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await Stories.share({
        png,
        target: instagram ? "instagram" : "share",
      });
      return result.destination === "chooser" && instagram
        ? tr(
            "Instagram n’est pas installé. Choisissez une autre application ou enregistrez le visuel.",
          )
        : tr("Le partage est ouvert.");
    }
    await navigator.share({ files: [file], title: "Vela" });
    return tr("Le partage est ouvert.");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        /cancel|annul|dismiss/i.test(error.message))
    )
      return "";
    throw error;
  }
}
export async function saveStory(file: File, png: string) {
  if (Capacitor.isNativePlatform()) {
    const result = await Stories.save({ png });
    return result.saved
      ? tr("Visuel enregistré. Vous pouvez l’ajouter à votre story Instagram.")
      : "";
  }
  downloadStory(file, file.name);
  return tr(
    "Visuel téléchargé. Vous pouvez l’ajouter à votre story Instagram.",
  );
}

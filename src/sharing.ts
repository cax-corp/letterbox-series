import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Clipboard } from "@capacitor/clipboard";
import { avatarAtlas } from "./Avatar";
import { avatarBackgrounds, avatarCell, type Profile } from "./profile";
import type { Entry, Library } from "./store";
import type { Title } from "./catalog";
import { profileStats } from "./profile-stats";
export type ShareCard = {
  kind: "profile" | "review" | "title";
  heading: string;
  author: string;
  text: string;
  body: string;
  detail: string;
  rating?: number;
  profile?: Profile;
};
export function publicTitleUrl(title: Title) {
  const match = /^tmdb-(movie|series)-(\d+)$/.exec(title.id);
  return match
    ? `https://www.themoviedb.org/${match[1] === "movie" ? "movie" : "tv"}/${match[2]}`
    : title.url && /^https:\/\//.test(title.url)
      ? title.url
      : "";
}
export function profileShare(
  profile: Profile,
  library: Library,
  fallback = "Mon profil Vela",
): ShareCard {
  const name = profile.displayName || fallback,
    s = profileStats(library),
    featured = profile.featured.map(
      (t) => `${t.name}${t.year ? ` (${t.year})` : ""}`,
    );
  const body = featured.length
    ? `Mes incontournables\n${featured.join("\n")}`
    : "Des histoires qui me ressemblent.";
  const detail = `${s.watched} histoire${s.watched === 1 ? "" : "s"} vue${s.watched === 1 ? "" : "s"} · ${s.reviews} avis${s.average !== null ? ` · ${s.average}/5 en moyenne` : ""}`;
  return {
    kind: "profile",
    heading: name,
    author: name,
    body,
    detail,
    profile,
    text: `${name} sur Vela\n${profile.bio ? profile.bio + "\n" : ""}${detail}\n${body}`,
  };
}
export function reviewShare(
  profile: Profile,
  entry: Entry,
  fallback = "Un regard sur Vela",
): ShareCard {
  const author = profile.displayName || fallback,
    heading = `${entry.title.name}${entry.title.year ? ` (${entry.title.year})` : ""}`;
  const detail =
      entry.rating > 0
        ? `${entry.rating}/5 · Mon avis sur Vela`
        : "Mon avis sur Vela",
    url = publicTitleUrl(entry.title);
  return {
    kind: "review",
    heading,
    author,
    body: entry.review.trim(),
    detail,
    rating: entry.rating,
    profile,
    text: `${heading}\nL’avis de ${author}${entry.rating > 0 ? ` · ${entry.rating}/5` : ""}\n\n${entry.review.trim()}\n\nVela${url ? "\n" + url : ""}`,
  };
}
export function titleShare(title: Title): ShareCard {
  const heading = `${title.name}${title.year ? ` (${title.year})` : ""}`,
    url = publicTitleUrl(title);
  return {
    kind: "title",
    heading,
    author: "À découvrir sur Vela",
    body: title.summary,
    detail:
      title.kind === "movie" ? "Un film à découvrir" : "Une série à découvrir",
    text: `${heading}\n${title.summary}\n\nÀ découvrir sur Vela${url ? "\n" + url : ""}`,
  };
}
function wrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.replace(/\s+/g, " ").trim().split(" "),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (
      ctx.measureText(line ? line + " " + word : word).width > width &&
      line
    ) {
      lines.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  const output = lines.slice(0, maxLines);
  if (lines.length > maxLines && output.length) {
    let last = output[output.length - 1];
    while (last && ctx.measureText(last + "…").width > width)
      last = last.slice(0, -1);
    output[output.length - 1] = last + "…";
  }
  output.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + output.length * lineHeight;
}
export async function renderShareCard(card: ShareCard): Promise<Blob> {
  if (document.fonts) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("La carte ne peut pas être générée.");
  const gradient = c.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#142D3C");
  gradient.addColorStop(1, "#0B141B");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1080, 1350);
  c.fillStyle = "#E4F1F9";
  c.font = "800 64px Manrope, sans-serif";
  c.fillText("vela", 80, 118);
  c.fillStyle = "#7BD0FF";
  c.beginPath();
  c.arc(217, 110, 6, 0, 2 * Math.PI);
  c.fill();
  c.font = '500 23px "DM Sans", sans-serif';
  c.fillStyle = "#A6BAC8";
  c.fillText(
    card.kind === "profile"
      ? "MON COIN DE CINÉMA"
      : card.kind === "review"
        ? "UNE HISTOIRE, MON REGARD"
        : "À VOIR ENSEMBLE",
    80,
    188,
  );
  let top = 275;
  if (card.profile) {
    const p = card.profile,
      bg =
        avatarBackgrounds.find((b) => b.id === p.background) ||
        avatarBackgrounds[0];
    c.save();
    c.beginPath();
    c.arc(138, top + 50, 58, 0, 2 * Math.PI);
    c.clip();
    c.fillStyle = bg.color;
    c.fillRect(80, top - 8, 116, 116);
    if (p.avatar !== "initial") {
      try {
        const image = new Image();
        image.src = avatarAtlas();
        await image.decode();
        const [x, y] = avatarCell(p.avatar);
        c.drawImage(
          image,
          (x * image.naturalWidth) / 2,
          (y * image.naturalHeight) / 2,
          image.naturalWidth / 2,
          image.naturalHeight / 2,
          80,
          top - 8,
          116,
          116,
        );
      } catch {
        c.fillStyle = bg.ink;
        c.font = "700 50px Manrope";
        c.fillText("V", 120, top + 68);
      }
    } else {
      c.fillStyle = bg.ink;
      c.font = "700 50px Manrope";
      c.fillText(
        Array.from(card.author)[0]?.toUpperCase() || "V",
        120,
        top + 68,
      );
    }
    c.restore();
    c.fillStyle = "#C4D9E6";
    c.font = '500 28px "DM Sans", sans-serif';
    wrapped(
      c,
      card.kind === "profile" ? "Mon carnet de cinéma" : card.author,
      224,
      top + 60,
      760,
      36,
      2,
    );
    top += 180;
  }
  c.fillStyle = "#E4F1F9";
  c.font = "800 58px Manrope, sans-serif";
  top = wrapped(c, card.heading, 80, top, 920, 72, 3) + 32;
  c.fillStyle = "#7BD0FF";
  c.font = '600 28px "DM Sans", sans-serif';
  top = wrapped(c, card.detail, 80, top, 920, 40, 2) + 42;
  if (card.kind === "profile" && card.profile?.bio) {
    c.fillStyle = "#C2D5E1";
    c.font = '400 30px "DM Sans", sans-serif';
    top = wrapped(c, card.profile.bio, 80, top, 920, 45, 3) + 35;
  }
  c.fillStyle = "#E4F1F9";
  if (card.kind === "profile" && card.profile?.featured.length) {
    c.font = '600 23px "DM Sans", sans-serif';
    c.fillStyle = "#A6BAC8";
    c.fillText("MES INCONTOURNABLES", 80, top);
    top += 42;
    const rowHeight = Math.max(
      32,
      Math.min(74, (1205 - top) / card.profile.featured.length),
    );
    const fontSize = Math.min(32, rowHeight * 0.5);
    card.profile.featured.forEach((title, i) => {
      c.font = `500 ${fontSize}px "DM Sans", sans-serif`;
      c.fillStyle = "#7BD0FF";
      c.fillText(String(i + 1).padStart(2, "0"), 80, top);
      c.fillStyle = "#E4F1F9";
      wrapped(
        c,
        `${title.name}${title.year ? ` (${title.year})` : ""}`,
        145,
        top,
        855,
        rowHeight,
        1,
      );
      top += rowHeight;
    });
  } else {
    c.font = '400 34px "DM Sans", sans-serif';
    const available = Math.max(2, Math.floor((1190 - top) / 50));
    wrapped(c, card.body, 80, top, 920, 50, available);
  }
  c.fillStyle = "#A6BAC8";
  c.font = '400 23px "DM Sans", sans-serif';
  c.fillText("FAIT POUR AIMER LES HISTOIRES.", 80, 1285);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image indisponible.")),
      "image/png",
    ),
  );
}
export type ShareOutcome = "shared" | "copied" | "cancelled";
function cancelled(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /cancel|dismiss|annul/i.test(error.message))
  );
}
async function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
export async function shareCard(card: ShareCard): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      const blob = await renderShareCard(card),
        file = await Filesystem.writeFile({
          path: `vela-partage-${card.kind}.png`,
          data: await base64(blob),
          directory: Directory.Cache,
        });
      await Share.share({
        title: card.heading,
        text: card.text,
        files: [file.uri],
        dialogTitle: "Partager avec…",
      });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
      await Clipboard.write({ string: card.text });
      return "copied";
    }
  }
  if (navigator.share) {
    try {
      const blob = await renderShareCard(card),
        file = new File([blob], "vela-partage.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          title: card.heading,
          text: card.text,
          files: [file],
        });
      else await navigator.share({ title: card.heading, text: card.text });
      return "shared";
    } catch (error) {
      if (cancelled(error)) return "cancelled";
    }
  }
  await Clipboard.write({ string: card.text });
  return "copied";
}
export function shareMessage(outcome: ShareOutcome) {
  return outcome === "shared"
    ? "Le partage est ouvert."
    : outcome === "copied"
      ? "Texte copié. Collez-le dans l’application de votre choix."
      : "Partage annulé.";
}

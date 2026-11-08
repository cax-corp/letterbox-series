import type { Entry } from "./store";
import type { Profile } from "./profile";
import { getColourTheme, readColourTheme } from "./colour-themes";
import { artworkBlob, dominantTone } from "./useArtworkTone";
import { getLanguage, t as tr } from "./i18n";

export type StoryDraft = { entry: Entry; profile: Profile };
export type StoryStyle = "poster" | "review";
export type StoryAssets = {
  poster: HTMLImageElement | null;
  avatar: HTMLImageElement | null;
  avatarBackground: string;
  avatarInk: string;
  tone: string | null;
  missingPoster: boolean;
};
export const storySize = { width: 1080, height: 1920 };
async function imageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function prepareStoryAssets(
  draft: StoryDraft,
  avatarNode: HTMLElement,
): Promise<StoryAssets> {
  const style = getComputedStyle(avatarNode),
    svg = avatarNode.querySelector("svg");
  const bg = style.backgroundColor,
    ink = style.color;
  const clone = svg?.cloneNode(true) as SVGElement | undefined;
  if (clone) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "100");
    clone.setAttribute("height", "100");
  }
  const avatar = draft.profile.photo
    ? (draft.profile.photo.startsWith("data:")
        ? imageFromBlob(
            new Blob(
              [
                Uint8Array.from(atob(draft.profile.photo.slice(23)), (c) =>
                  c.charCodeAt(0),
                ),
              ],
              { type: "image/jpeg" },
            ),
          )
        : artworkBlob(draft.profile.photo).then(imageFromBlob)
      ).catch(() => null)
    : clone
      ? imageFromBlob(
          new Blob(
            [
              new XMLSerializer()
                .serializeToString(clone)
                .replace(/currentColor/g, ink)
                .replace(/var\(--avatar-background\)/g, bg),
            ],
            { type: "image/svg+xml" },
          ),
        ).catch(() => null)
      : Promise.resolve(null);
  const poster = draft.entry.title.image
    ? artworkBlob(draft.entry.title.image)
        .then(imageFromBlob)
        .catch(() => null)
    : Promise.resolve(null);
  const [portrait, face] = await Promise.all([poster, avatar]);
  let tone: string | null = null;
  if (portrait) {
    const sample = document.createElement("canvas");
    sample.width = sample.height = 24;
    const context = sample.getContext("2d");
    if (context) {
      context.drawImage(portrait, 0, 0, 24, 24);
      tone = dominantTone(context.getImageData(0, 0, 24, 24).data);
    }
  }
  return {
    poster: portrait,
    avatar: face,
    avatarBackground: bg,
    avatarInk: ink,
    tone,
    missingPoster: Boolean(draft.entry.title.image && !portrait),
  };
}
export function wrapStoryText(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  width: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/u),
    lines: string[] = [];
  let line = "",
    truncated = false;
  for (const word of words) {
    for (const part of context.measureText(word).width > width
      ? Array.from(word)
      : [word]) {
      const next = line ? `${line}${part === word ? " " : ""}${part}` : part;
      if (line && context.measureText(next).width > width) {
        lines.push(line);
        line = part;
      } else line = next;
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length) {
    let tail = lines[lines.length - 1];
    while (context.measureText(tail + "…").width > width && tail)
      tail = Array.from(tail).slice(0, -1).join("");
    lines[lines.length - 1] = tail.trimEnd() + "…";
  }
  return { lines, truncated };
}
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}
function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? radius * 0.46 : radius;
    const px = x + Math.cos(angle) * r,
      py = y + Math.sin(angle) * r;
    if (!i) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
export async function renderStory(
  draft: StoryDraft,
  assets: StoryAssets,
  format: StoryStyle,
): Promise<{ blob: Blob; truncated: boolean }> {
  // Fonts are bundled. A font failure must not leave sharing waiting indefinitely.
  await Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = storySize.width;
  canvas.height = storySize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(tr("Le visuel ne peut pas être généré sur cet appareil."));
  const preset = getColourTheme(readColourTheme()),
    quote = format === "review" && Boolean(draft.entry.review.trim());
  const tone = assets.tone?.split(" ").map(Number) || [20, 44, 62];
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
  gradient.addColorStop(
    0,
    `rgb(${tone.map((c) => Math.round(c * 0.5)).join(" ")})`,
  );
  gradient.addColorStop(0.68, "#09101a");
  gradient.addColorStop(1, "#04080f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);
  const width = quote ? 450 : 620,
    height = width * 1.5,
    x = (1080 - width) / 2,
    y = quote ? 240 : 260;
  ctx.save();
  ctx.shadowColor = "#0009";
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = "#142330";
  rounded(ctx, x, y, width, height, 24);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rounded(ctx, x, y, width, height, 24);
  ctx.clip();
  if (assets.poster) {
    const image = assets.poster,
      scale = Math.min(
        width / image.naturalWidth,
        height / image.naturalHeight,
      ),
      w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#b6cddd";
    ctx.font = '800 88px "Manrope", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("vela", 540, y + height / 2);
  }
  ctx.restore();
  ctx.strokeStyle = "#ffffff2e";
  ctx.lineWidth = 2;
  rounded(ctx, x, y, width, height, 24);
  ctx.stroke();
  const avatarY = y - 18;
  ctx.save();
  ctx.shadowColor = "#0007";
  ctx.shadowBlur = 18;
  ctx.fillStyle = assets.avatarBackground;
  ctx.beginPath();
  ctx.arc(540, avatarY, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(540, avatarY, 50, 0, Math.PI * 2);
  ctx.clip();
  if (assets.avatar) ctx.drawImage(assets.avatar, 490, avatarY - 50, 100, 100);
  else {
    ctx.fillStyle = assets.avatarInk;
    ctx.font = '700 52px "Manrope", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      Array.from(draft.profile.displayName.trim())[0]?.toLocaleUpperCase(
        getLanguage(),
      ) || "V",
      540,
      avatarY + 2,
    );
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f0f7fc";
  ctx.font = `700 ${quote ? 56 : 62}px "Manrope", sans-serif`;
  const title = wrapStoryText(ctx, draft.entry.title.name, 900, 2),
    titleY = quote ? 985 : 1270;
  title.lines.forEach((line, i) => ctx.fillText(line, 540, titleY + i * 74));
  const scoreY = quote ? 1148 : 1450,
    rating = Math.max(0, Math.min(5, draft.entry.rating));
  if (rating)
    for (let i = 0; i < 5; i++) {
      const sx = 540 + (i - 2) * 65;
      ctx.fillStyle = "#ffffff26";
      star(ctx, sx, scoreY, 25);
      ctx.fill();
      const fraction = Math.min(1, Math.max(0, rating - i));
      if (fraction) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx - 25, scoreY - 27, 50 * fraction, 54);
        ctx.clip();
        ctx.fillStyle = preset.hex;
        star(ctx, sx, scoreY, 25);
        ctx.fill();
        ctx.restore();
      }
    }
  else {
    ctx.fillStyle = "#c1ced9";
    ctx.font = '500 32px "DM Sans", sans-serif';
    ctx.fillText(tr("Non noté"), 540, scoreY + 10);
  }
  if (draft.entry.favorite) {
    ctx.fillStyle = preset.hex;
    ctx.font = "44px sans-serif";
    ctx.fillText("♥", 748, scoreY + 16);
  }
  let excerpt = false;
  if (quote) {
    ctx.fillStyle = "#dde7ef";
    ctx.font = '400 40px "DM Sans", sans-serif';
    const text = wrapStoryText(ctx, draft.entry.review, 860, 5);
    excerpt = text.truncated;
    text.lines.forEach((line, i) => ctx.fillText(line, 540, 1248 + i * 51));
  }
  ctx.fillStyle = "#a6bacb";
  ctx.font = '500 31px "DM Sans", sans-serif';
  ctx.fillText(
    draft.profile.displayName.trim() || tr("Mon avis"),
    540,
    1560,
    880,
  );
  ctx.strokeStyle = "#b4c7d03d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(470, 1596);
  ctx.lineTo(610, 1596);
  ctx.stroke();
  ctx.font = '800 68px "Manrope", sans-serif';
  ctx.textAlign = "left";
  const logoWidth = ctx.measureText("vela").width,
    logoX = (1080 - logoWidth - 20) / 2;
  ctx.fillStyle = "#edf6fc";
  ctx.fillText("vela", logoX, 1675);
  ctx.fillStyle = preset.hex;
  ctx.beginPath();
  ctx.arc(logoX + logoWidth + 13, 1668, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#92a5b6";
  ctx.font = '400 25px "DM Sans", sans-serif';
  ctx.fillText("vela.thomasbarial.com", 540, 1724);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(
              new Error(
                tr("Le visuel ne peut pas être généré sur cet appareil."),
              ),
            ),
      "image/png",
    ),
  );
  canvas.width = canvas.height = 1;
  return { blob, truncated: excerpt };
}

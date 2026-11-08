import { useEffect, useState, type CSSProperties } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const tones = new Map<string, Promise<string | null>>();

/** Count nearby shades together: a large yellow region beats a small saturated blue patch. */
export function dominantTone(pixels: Uint8ClampedArray): string | null {
  const bins = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, alpha] = pixels.slice(i, i + 4);
    if (alpha < 128) continue;
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  const colors = [...bins.values()].map((c) => ({
    ...c,
    r: c.r / c.count,
    g: c.g / c.count,
    b: c.b / c.count,
  }));
  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const center of colors) {
    const cluster = { count: 0, r: 0, g: 0, b: 0 };
    for (const c of colors) {
      if (
        (center.r - c.r) ** 2 + (center.g - c.g) ** 2 + (center.b - c.b) ** 2 >
        72 ** 2
      )
        continue;
      cluster.count += c.count;
      cluster.r += c.r * c.count;
      cluster.g += c.g * c.count;
      cluster.b += c.b * c.count;
    }
    if (cluster.count > best.count) best = cluster;
  }
  return best.count
    ? [best.r, best.g, best.b].map((c) => Math.round(c / best.count)).join(" ")
    : null;
}

export async function artworkBlob(url: string): Promise<Blob> {
  if (Capacitor.isNativePlatform()) {
    // The Android HTTP transport reads CDN bytes without the WebView's canvas/CORS cache constraints.
    const response = await CapacitorHttp.get({
      url,
      responseType: "arraybuffer",
      connectTimeout: 5000,
      readTimeout: 10000,
    });
    if (
      response.status < 200 ||
      response.status >= 300 ||
      typeof response.data !== "string"
    )
      throw new Error("Artwork unavailable");
    const type =
      Object.entries(response.headers).find(
        ([key]) => key.toLowerCase() === "content-type",
      )?.[1] || "image/jpeg";
    if (!type.startsWith("image/")) throw new Error("Invalid artwork");
    const bytes = Uint8Array.from(atob(response.data.replace(/\s/g, "")), (c) =>
      c.charCodeAt(0),
    );
    return new Blob([bytes], { type });
  }
  // Reload avoids reusing an opaque image response previously cached by a normal <img>.
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    cache: "reload",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Artwork unavailable");
  return response.blob();
}
async function readTone(url: string, aspect: number): Promise<string | null> {
  const blob = await artworkBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    // Match the centered object-fit: cover crop actually visible on the card.
    let width = image.naturalWidth,
      height = image.naturalHeight;
    if (aspect > 0) {
      if (width / height > aspect) width = height * aspect;
      else height = width / aspect;
    }
    ctx.drawImage(
      image,
      (image.naturalWidth - width) / 2,
      (image.naturalHeight - height) / 2,
      width,
      height,
      0,
      0,
      48,
      48,
    );
    return dominantTone(ctx.getImageData(0, 0, 48, 48).data);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
function artworkTone(url: string, aspect: number): Promise<string | null> {
  const key = `${url}|${aspect}`;
  if (!url) return Promise.resolve(null);
  const cached = tones.get(key);
  if (cached) return cached;
  const result = readTone(url, aspect)
    .catch(() => null)
    .then((tone) => {
      // Failed reads can recover on a later mount, instead of permanently caching a blue fallback.
      if (!tone && tones.get(key) === result) tones.delete(key);
      return tone;
    });
  if (tones.size >= 128) tones.delete(tones.keys().next().value!);
  tones.set(key, result);
  return result;
}
export function useArtworkTone(url: string, aspect = 0, keepPrevious = false) {
  const ratio = Number(aspect.toFixed(3));
  const key = `${url}|${ratio}`;
  const [tone, setTone] = useState<{ url: string; value: string | null }>({
    url: "",
    value: null,
  });
  useEffect(() => {
    let active = true;
    artworkTone(url, ratio).then((value) => {
      if (active) setTone({ url: key, value });
    });
    return () => {
      active = false;
    };
  }, [url, ratio]);
  // Preserve the last valid background while the next image's pixels are decoded.
  return tone.url === key || keepPrevious ? tone.value : null;
}
export const toneStyle = (tone: string | null) =>
  ({
    "--art-rgb": tone || "128 128 128",
    "--art-ready": tone ? "1" : "0",
  }) as CSSProperties;

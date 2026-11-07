import { useEffect, useRef } from "react";
import { projectTastePoint, type TasteRotation } from "./taste-map";
// Original procedural scenery. Decorative dust never appears in the personal graph or counts.
let nebula: HTMLCanvasElement | undefined;
function cloud() {
  if (nebula) return nebula;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      a = x - ix,
      b = y - iy,
      u = a * a * (3 - 2 * a),
      v = b * b * (3 - 2 * b);
    return (
      (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
      (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
    );
  };
  for (let y = 0; y < 300; y++)
    for (let x = 0; x < 480; x++) {
      const nx = x / 480,
        ny = y / 300;
      let n = 0,
        amp = 0.55,
        freq = 3.4;
      for (let o = 0; o < 5; o++) {
        n += noise(nx * freq + 14, ny * freq + 5) * amp;
        amp *= 0.49;
        freq *= 2.1;
      }
      const band = Math.exp(
        -Math.pow((ny - 0.69 + nx * 0.39 + Math.sin(nx * 9) * 0.1) * 3.5, 2),
      );
      const wisps = Math.pow(Math.max(0, n - 0.18), 1.8) * band;
      const warm = Math.exp(-((nx - 0.82) ** 2 * 14 + (ny - 0.63) ** 2 * 12));
      const i = (y * 480 + x) * 4;
      pixels.data[i] = 3 + wisps * (28 + warm * 100);
      pixels.data[i + 1] = 7 + wisps * (68 + warm * 25);
      pixels.data[i + 2] = 17 + wisps * (145 - warm * 75);
      pixels.data[i + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  nebula = canvas;
  return canvas;
}
let state = 78123;
const random = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967295;
};
const dust = Array.from({ length: 1150 }, () => ({
  x: (random() - 0.5) * 2800,
  y: (random() - 0.5) * 1800,
  z: random() * 1250 - 250,
  r: 0.28 + random() * 0.85,
  color: Math.floor(random() * 4),
}));
const colors = ["#d2e7ff", "#9bc9ff", "#dcc7ed", "#ffe5b6"];
export default function StellarBackdrop({
  rotation,
  zoom,
  pan,
}: {
  rotation: TasteRotation;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      if (document.hidden) return;
      const rect = canvas.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, 1.5);
      if (!rect.width || !rect.height) return;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const unit = rect.height / 600;
      ctx.fillStyle = "#020611";
      ctx.fillRect(0, 0, rect.width, rect.height);
      const parallaxX = Math.max(-100, Math.min(100, pan.x * 0.1)),
        parallaxY = Math.max(-70, Math.min(70, pan.y * 0.1));
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        cloud(),
        -rect.width * 0.2 + parallaxX,
        -rect.height * 0.2 + parallaxY,
        rect.width * 1.4,
        rect.height * 1.4,
      );
      ctx.globalAlpha = 1;
      for (const star of dust) {
        const p = projectTastePoint(star, rotation, 0.75 + zoom * 0.18);
        if (p.depth < -500 || p.scale <= 0 || !Number.isFinite(p.x + p.y))
          continue;
        const x = rect.width / 2 + (p.x + pan.x * 0.15) * unit,
          y = rect.height / 2 + (p.y + pan.y * 0.15) * unit;
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) continue;
        const r = star.r * Math.min(1.5, p.scale) * Math.max(0.8, unit * 0.75);
        ctx.globalAlpha = 0.2 + star.r * 0.47;
        ctx.fillStyle = colors[star.color];
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2);
        ctx.fill();
        if (star.r > 1.03) {
          ctx.globalAlpha = 0.07;
          ctx.beginPath();
          ctx.arc(x, y, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", paint);
    paint();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", paint);
    };
  }, [rotation, zoom, pan.x, pan.y]);
  return <canvas ref={ref} className="stellar-backdrop" aria-hidden="true" />;
}

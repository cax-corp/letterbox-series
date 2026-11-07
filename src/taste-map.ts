import type { Title } from "./catalog";
import type { Library } from "./store";
import type { SkipSignal } from "./implicit-feedback";
import {
  buildTasteProfile,
  movieGenres,
  movieGenreNames,
} from "./recommendations";
import { contentVectors, cosine } from "./local-ranking";
import { tasteFamily } from "./taste-features";
export type Point3 = { x: number; y: number; z: number };
export type TasteItem = {
  id: string;
  title: Title;
  kind: "positive" | "negative" | "watchlist" | "skip" | "neutral";
  weight: number;
  rating: number;
  favorite: boolean;
  genres: number[];
  family: string;
};
export type TasteNode = Point3 & {
  id: string;
  genre?: number;
  item?: TasteItem;
  label: string;
  weight: number;
};
export type TasteEdge = {
  a: string;
  b: string;
  kind: "genre" | "similarity";
  strength: number;
};
const hash = (s: string) =>
  [...s].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 17) >>> 0;
export function buildTasteMap(
  library: Library,
  skips: SkipSignal[] = [],
  limit = 300,
  focusId?: string,
) {
  const profile = buildTasteProfile(library, skips);
  const items: TasteItem[] = profile.entries
    .filter(
      (e) =>
        e.favorite ||
        e.rating ||
        e.watchlist ||
        e.watched ||
        e.recommendationFeedback,
    )
    .map((e) => {
      const weight = profile.weights.get(e.title.id) || 0;
      return {
        id: e.title.id,
        title: e.title,
        weight,
        rating: e.rating,
        favorite: e.favorite,
        kind:
          weight < 0
            ? "negative"
            : weight > 1
              ? "positive"
              : e.watchlist
                ? "watchlist"
                : "neutral",
        genres: movieGenres(e.title),
        family: tasteFamily(e.title, movieGenres(e.title)),
      };
    });
  for (const skip of profile.implicit || [])
    items.push({
      id: skip.title.id,
      title: skip.title,
      kind: "skip",
      weight: -skip.strength,
      rating: 0,
      favorite: false,
      genres: movieGenres(skip.title),
      family: tasteFamily(skip.title, movieGenres(skip.title)),
    });
  const ordered = items.sort(
    (a, b) =>
      Math.abs(b.weight) - Math.abs(a.weight) ||
      a.title.name.localeCompare(b.title.name),
  );
  const groups = new Map<string, TasteItem[]>();
  for (const item of ordered) {
    const key = `${item.kind}:${item.family}`,
      group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  const shown: TasteItem[] = [];
  let row = 0;
  while (shown.length < Math.min(limit, items.length)) {
    for (const group of groups.values())
      if (group[row] && shown.length < limit) shown.push(group[row]);
    row++;
  }
  const focus = items.find((item) => item.id === focusId);
  if (focus && !shown.some((item) => item.id === focus.id) && shown.length)
    shown[shown.length - 1] = focus;
  const used = [
    ...new Set(
      shown.flatMap((item) => (item.genres.length ? item.genres : [0])),
    ),
  ].sort((a, b) => a - b);
  // Genre hubs start inside an irregular volume. Nothing is placed on a spherical shell.
  const nodes: TasteNode[] = used.map((genre) => {
    const seed = hash(`genre:${genre}`);
    const angle = (seed % 6283) / 1000;
    const radius = 65 + ((seed >>> 8) % 80);
    return {
      id: `genre:${genre}`,
      genre,
      label:
        genre === 0
          ? "Sans genre"
          : movieGenreNames[genre].replace(/^(?:les? |la |l’)/, ""),
      weight: profile.genres.get(genre) || 0,
      x: Math.cos(angle) * radius * 1.18,
      y: (((seed >>> 16) % 201) - 100) * 0.8,
      z: Math.sin(angle) * radius * 0.85,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: TasteEdge[] = [];
  for (const item of shown) {
    const anchors = (item.genres.length ? item.genres : [0]).map((g) =>
      byId.get(`genre:${g}`)!,
    );
    const n = anchors.length,
      seed = hash(item.id);
    const node: TasteNode = {
      id: item.id,
      item,
      label: item.title.name,
      weight: item.weight,
      x: anchors.reduce((s, a) => s + a.x, 0) / n + ((seed % 43) - 21),
      y: anchors.reduce((s, a) => s + a.y, 0) / n + (((seed >>> 8) % 43) - 21),
      z: anchors.reduce((s, a) => s + a.z, 0) / n + (((seed >>> 16) % 43) - 21),
    };
    nodes.push(node);
    byId.set(node.id, node);
    for (const anchor of anchors)
      edges.push({ a: node.id, b: anchor.id, kind: "genre", strength: 1 / n });
  }
  const vector = contentVectors(
      shown.map((item) => item.title),
      movieGenres,
    ),
    seen = new Set<string>();
  const neighbours = new Map<string, { id: string; similarity: number }[]>();
  for (const item of shown) {
    const close = shown
      .filter((other) => other.id !== item.id)
      .map((other) => ({
        id: other.id,
        similarity: cosine(vector(item.title), vector(other.title)),
      }))
      .filter((e) => e.similarity > 0.32)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
    neighbours.set(item.id, close);
    for (const other of close.slice(0, 2)) {
      const key = [item.id, other.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        a: item.id,
        b: other.id,
        kind: "similarity",
        strength: other.similarity,
      });
    }
  }
  // Rest-length springs plus repulsion create clusters and branches in 3D.
  // Hubs also move. A gentle centering force replaces the former hard sphere boundary.
  const velocity = nodes.map(() => ({ x: 0, y: 0, z: 0 }));
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  for (let iteration = 0; iteration < 100; iteration++) {
    const forces = nodes.map((n) => ({
      x: -n.x * 0.0015,
      y: -n.y * 0.0015,
      z: -n.z * 0.0015,
    }));
    for (const edge of edges) {
      const ai = index.get(edge.a)!,
        bi = index.get(edge.b)!,
        a = nodes[ai],
        b = nodes[bi];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const distance = Math.max(1, Math.hypot(dx, dy, dz));
      const rest = edge.kind === "genre" ? 46 : 34;
      const spring = ((distance - rest) * 0.013 * edge.strength) / distance;
      for (const axis of ["x", "y", "z"] as const) {
        const f = (b[axis] - a[axis]) * spring;
        forces[ai][axis] += f;
        forces[bi][axis] -= f;
      }
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = a.x - b.x,
          dy = a.y - b.y,
          dz = a.z - b.z;
        const d2 = Math.max(36, dx * dx + dy * dy + dz * dz);
        const factor = 170 / (d2 * Math.sqrt(d2));
        const fx = dx * factor,
          fy = dy * factor,
          fz = dz * factor;
        forces[i].x += fx;
        forces[j].x -= fx;
        forces[i].y += fy;
        forces[j].y -= fy;
        forces[i].z += fz;
        forces[j].z -= fz;
      }
    nodes.forEach((n, i) => {
      for (const axis of ["x", "y", "z"] as const) {
        velocity[i][axis] = (velocity[i][axis] + forces[i][axis]) * 0.78;
        n[axis] += velocity[i][axis];
      }
    });
  }
  // Uniform fitting preserves the relative layout, rather than pushing points onto a surface.
  if (nodes.length) {
    const centre = { x: 0, y: 0, z: 0 };
    for (const axis of ["x", "y", "z"] as const)
      centre[axis] = nodes.reduce((sum, n) => sum + n[axis], 0) / nodes.length;
    const radius = Math.max(
      1,
      ...nodes.map((n) =>
        Math.hypot(n.x - centre.x, n.y - centre.y, n.z - centre.z),
      ),
    );
    const scale = Math.min(1.7, 175 / radius);
    for (const n of nodes)
      for (const axis of ["x", "y", "z"] as const)
        n[axis] = (n[axis] - centre[axis]) * scale;
  }
  return { nodes, edges, items, shown: shown.length, neighbours };
}
export type TasteRotation = { x: number; y: number; z: number; w: number };
export const initialTasteRotation: TasteRotation = { x: 0, y: 0, z: 0, w: 1 };
export function rotateTasteView(
  q: TasteRotation,
  dx: number,
  dy: number,
): TasteRotation {
  const distance = Math.hypot(dx, dy);
  if (!distance) return q;
  // Premultiply a screen-space delta: the near side follows the pointer on both axes,
  // even after a quarter turn or a full inversion. There is no Euler pitch pole.
  const half = distance * 0.004,
    sine = Math.sin(half) / distance;
  const ax = dy * sine,
    ay = -dx * sine,
    aw = Math.cos(half);
  const next = {
    x: aw * q.x + ax * q.w + ay * q.z,
    y: aw * q.y + ay * q.w - ax * q.z,
    z: aw * q.z + ax * q.y - ay * q.x,
    w: aw * q.w - ax * q.x - ay * q.y,
  };
  const norm = Math.hypot(next.x, next.y, next.z, next.w);
  return {
    x: next.x / norm,
    y: next.y / norm,
    z: next.z / norm,
    w: next.w / norm,
  };
}
export function projectTastePoint(
  point: Point3,
  rotation: TasteRotation,
  zoom: number,
) {
  const q = rotation;
  const tx = 2 * (q.y * point.z - q.z * point.y),
    ty = 2 * (q.z * point.x - q.x * point.z),
    tz = 2 * (q.x * point.y - q.y * point.x);
  const x = point.x + q.w * tx + q.y * tz - q.z * ty;
  const y = point.y + q.w * ty + q.z * tx - q.x * tz;
  const depth = point.z + q.w * tz + q.x * ty - q.y * tx;
  const scale = (620 / (620 + depth)) * zoom;
  const near = Math.max(0, Math.min(1, (175 - depth) / 350));
  // Far nodes remain present, but recede strongly. Selection can override this in the UI.
  const opacity = 0.12 + 0.88 * Math.pow(near, 1.6);
  return { x: x * scale, y: y * scale, depth, scale, opacity };
}

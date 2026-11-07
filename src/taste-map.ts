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
  limit = 120,
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
  const used = [
    ...new Set(
      shown.flatMap((item) => (item.genres.length ? item.genres : [0])),
    ),
  ].sort((a, b) => a - b);
  const allGenres = [
    0,
    ...Object.keys(movieGenreNames)
      .map(Number)
      .sort((a, b) => a - b),
  ];
  const nodes: TasteNode[] = used.map((genre) => {
    const i = allGenres.indexOf(genre),
      y = 1 - (2 * (i + 0.5)) / allGenres.length,
      r = Math.sqrt(1 - y * y),
      phi = i * Math.PI * (3 - Math.sqrt(5));
    return {
      id: `genre:${genre}`,
      genre,
      label:
        genre === 0
          ? "Sans genre"
          : movieGenreNames[genre].replace(/^(?:les? |la |l’)/, ""),
      weight: profile.genres.get(genre) || 0,
      x: Math.cos(phi) * r * 135,
      y: y * 135,
      z: Math.sin(phi) * r * 135,
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
  // Deterministic spring layout: genre anchors stay fixed; related titles attract, distinct dots repel.
  const films = nodes.filter((node) => node.item);
  for (let iteration = 0; iteration < 55; iteration++) {
    const moves = new Map(films.map((n) => [n.id, { x: 0, y: 0, z: 0 }]));
    for (const edge of edges) {
      const a = byId.get(edge.a)!,
        b = byId.get(edge.b)!,
        factor = (edge.kind === "genre" ? 0.014 : 0.009) * edge.strength;
      for (const [node, other] of [
        [a, b],
        [b, a],
      ]) {
        const d = moves.get(node.id);
        if (d) {
          d.x += (other.x - node.x) * factor;
          d.y += (other.y - node.y) * factor;
          d.z += (other.z - node.z) * factor;
        }
      }
    }
    for (let i = 0; i < films.length; i++)
      for (let j = i + 1; j < films.length; j++) {
        const a = films[i],
          b = films[j],
          x = a.x - b.x,
          y = a.y - b.y,
          z = a.z - b.z,
          dist = Math.max(20, x * x + y * y + z * z),
          force = Math.min(0.4, 110 / dist),
          aa = moves.get(a.id)!,
          bb = moves.get(b.id)!;
        aa.x += x * force;
        aa.y += y * force;
        aa.z += z * force;
        bb.x -= x * force;
        bb.y -= y * force;
        bb.z -= z * force;
      }
    for (const node of films) {
      const d = moves.get(node.id)!;
      node.x += d.x;
      node.y += d.y;
      node.z += d.z;
      const radius = Math.hypot(node.x, node.y, node.z);
      if (radius > 190) {
        node.x *= 190 / radius;
        node.y *= 190 / radius;
        node.z *= 190 / radius;
      }
    }
  }
  return { nodes, edges, items, shown: shown.length, neighbours };
}
export function projectTastePoint(
  point: Point3,
  yaw: number,
  pitch: number,
  zoom: number,
) {
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw),
    z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw),
    y = point.y * Math.cos(pitch) - z * Math.sin(pitch),
    depth = point.y * Math.sin(pitch) + z * Math.cos(pitch),
    scale = (650 / (650 + depth)) * zoom;
  return { x: x * scale, y: y * scale, depth, scale };
}

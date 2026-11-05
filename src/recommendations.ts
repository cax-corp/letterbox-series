import { rankLocally } from "./local-ranking";
import type { SkipSignal } from "./implicit-feedback";
import {
  discoverMoviesForTastePage,
  relatedMoviesPage,
  isTmdb,
  movies,
  tmdbEnabled,
  type Title,
} from "./catalog";
import type { Entry } from "./store";
export type TasteProfile = {
  entries: Entry[];
  seeds: Entry[];
  genres: Map<number, number>;
  weights: Map<string, number>;
  pairs: Map<string, number>;
  likedGenres: Map<number, number>;
  preferredGenres: number[];
  positiveCount: number;
  negativeCount: number;
  unratedCount: number;
  fetchKey: string;
  rankKey?: string;
  implicit?: SkipSignal[];
};
export type Candidate = {
  title: Title;
  seeds: { id: string; name: string; rank: number }[];
};
export type Suggestion = { title: Title; reason: string; score: number };
export type RecommendationPool = { candidates: Candidate[]; warning?: string };
export const movieGenreNames: Record<number, string> = {
  28: "l’action",
  12: "l’aventure",
  16: "l’animation",
  35: "la comédie",
  80: "le polar",
  99: "le documentaire",
  18: "le drame",
  10751: "le cinéma familial",
  14: "le fantastique",
  36: "l’histoire",
  27: "l’horreur",
  10402: "la musique",
  9648: "le mystère",
  10749: "la romance",
  878: "la science-fiction",
  10770: "les téléfilms",
  53: "le thriller",
  10752: "les films de guerre",
  37: "le western",
};
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const genreAliases: Record<string, number[]> = {
  action: [28],
  adventure: [12],
  aventure: [12],
  animation: [16],
  comedy: [35],
  comedie: [35],
  crime: [80],
  polar: [80],
  documentary: [99],
  documentaire: [99],
  drama: [18],
  drame: [18],
  family: [10751],
  familial: [10751],
  fantasy: [14],
  fantastique: [14],
  history: [36],
  histoire: [36],
  horror: [27],
  horreur: [27],
  music: [10402],
  musique: [10402],
  mystery: [9648],
  mystere: [9648],
  romance: [10749],
  "science fiction": [878],
  "sci fi": [878],
  thriller: [53],
  war: [10752],
  guerre: [10752],
  western: [37],
  "action adventure": [28, 12],
  "action aventure": [28, 12],
  "action et aventure": [28, 12],
  "sci fi fantasy": [878, 14],
  "science fiction fantastique": [878, 14],
  "science fiction et fantastique": [878, 14],
};
export function movieGenres(title: Title): number[] {
  const ids = (title.genreIds || []).flatMap((id) =>
    id === 10759
      ? [28, 12]
      : id === 10765
        ? [878, 14]
        : id === 10768
          ? [10752]
          : movieGenreNames[id]
            ? [id]
            : [],
  );
  return [
    ...new Set([
      ...ids,
      ...title.genres.flatMap((g) => genreAliases[normalize(g)] || []),
    ]),
  ];
}
export function tasteWeight(entry: Entry): number {
  if (entry.recommendationFeedback === "dislike") return -5;
  if (entry.recommendationFeedback === "like")
    return 4 + (entry.rating >= 4 ? (entry.rating - 3) * 2 + 1 : 0);
  if (entry.rating > 0 && entry.rating <= 2) return -(7 - 2 * entry.rating);
  return (
    (entry.watchlist ? 0.5 : 0) +
    (entry.favorite ? 4 : 0) +
    (entry.rating >= 4 ? (entry.rating - 3) * 2 + 1 : 0) +
    (entry.watched && !entry.rating && !entry.favorite ? 0.25 : 0)
  );
}
export function buildTasteProfile(
  library: Record<string, Entry>,
  skipped: SkipSignal[] = [],
): TasteProfile {
  const entries = Object.values(library),
    genres = new Map<number, number>(),
    likedGenres = new Map<number, number>(),
    weights = new Map<string, number>(),
    pairs = new Map<string, number>();
  for (const entry of entries) {
    const ids = movieGenres(entry.title),
      base = tasteWeight(entry),
      age = Math.max(
        0,
        (Date.now() - Date.parse(entry.preferenceUpdated || entry.updated)) /
          86400000,
      ),
      weight =
        base > 1
          ? base *
            (0.8 +
              0.2 * Math.exp(-Math.floor(Number.isFinite(age) ? age : 0) / 90))
          : base;
    weights.set(entry.title.id, weight);
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        const key = [ids[a], ids[b]].sort((a, b) => a - b).join(":");
        pairs.set(
          key,
          (pairs.get(key) || 0) + weight / Math.max(1, ids.length - 1),
        );
      }
    for (const id of ids) {
      genres.set(id, (genres.get(id) || 0) + weight / ids.length);
      if (weight > 1)
        likedGenres.set(id, (likedGenres.get(id) || 0) + weight / ids.length);
    }
  }
  const seeds = entries
    .filter((e) => e.title.kind === "movie" && tasteWeight(e) > 1)
    .sort(
      (a, b) =>
        Date.parse(b.preferenceUpdated || b.updated) -
          Date.parse(a.preferenceUpdated || a.updated) ||
        tasteWeight(b) - tasteWeight(a) ||
        a.title.id.localeCompare(b.title.id),
    );
  // Compress repeated genre votes; every positive example still contributes to the model.
  for (const [id, weight] of genres)
    genres.set(id, Math.sign(weight) * Math.sqrt(Math.abs(weight)));
  const preferredGenres = [...genres]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 8)
    .map(([id]) => id);
  const known = movieIndex<Entry>((entry) => entry.title);
  for (const entry of entries)
    if (
      entry.favorite ||
      entry.rating > 0 ||
      entry.watchlist ||
      entry.watched ||
      entry.recommendationFeedback
    )
      known.add(entry);
  const implicit = skipped.filter((signal) => !known.find(signal.title));
  const fetchKey = JSON.stringify(
    entries
      .map((e) => [
        e.title.id,
        tasteWeight(e),
        e.watched,
        e.title.year,
        movieGenres(e.title),
        e.title.summary,
        e.title.name,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return {
    entries,
    seeds,
    genres,
    likedGenres,
    weights,
    pairs,
    preferredGenres,
    positiveCount: entries.filter((e) => tasteWeight(e) > 1).length,
    negativeCount: entries.filter((e) => tasteWeight(e) < 0).length,
    unratedCount: entries.filter((e) => e.watched && !e.rating && !e.favorite)
      .length,
    fetchKey,
    implicit,
    rankKey: JSON.stringify([
      fetchKey,
      implicit.map((s) => [s.title.id, Number(s.strength.toFixed(5))]),
    ]),
  };
}
const aliasCache = new WeakMap<Title, string[]>();
function aliases(title: Title) {
  const cached = aliasCache.get(title);
  if (cached) return cached;
  const result = [
    title.name,
    ...(isTmdb(title) && title.original ? [title.original] : []),
  ]
    .map(normalize)
    .filter(Boolean);
  aliasCache.set(title, result);
  return result;
}
export function sameMovie(a: Title, b: Title): boolean {
  return (
    a.kind === "movie" &&
    b.kind === "movie" &&
    (a.id === b.id ||
      ((!a.year || !b.year || a.year === b.year) &&
        aliases(a).some((name) => aliases(b).includes(name))))
  );
}
function movieIndex<T>(getTitle: (value: T) => Title) {
  const ids = new Map<string, T>(),
    names = new Map<string, Map<string, T>>();
  return {
    add(value: T) {
      const title = getTitle(value);
      if (title.kind !== "movie") return;
      ids.set(title.id, value);
      for (const name of aliases(title)) {
        const years = names.get(name) || new Map<string, T>();
        years.set(title.year || "", value);
        names.set(name, years);
      }
    },
    find(title: Title) {
      if (title.kind !== "movie") return undefined;
      const byId = ids.get(title.id);
      if (byId) return byId;
      for (const name of aliases(title)) {
        const years = names.get(name);
        if (!years) continue;
        const value = title.year
          ? years.get(title.year) || years.get("")
          : years.values().next().value;
        if (value) return value;
      }
      return undefined;
    },
  };
}
export function rankRecommendations(
  profile: TasteProfile,
  pool: Candidate[],
  previous: Title[] = [],
  limit = Infinity,
): Suggestion[] {
  const blocked = movieIndex<Entry>((entry) => entry.title),
    selected = movieIndex<Candidate>((candidate) => candidate.title);
  for (const entry of profile.entries)
    if (
      entry.watched ||
      entry.rating > 0 ||
      entry.favorite ||
      entry.recommendationFeedback
    )
      blocked.add(entry);
  const unique: Candidate[] = [];
  for (const candidate of pool) {
    if (candidate.title.kind !== "movie" || blocked.find(candidate.title))
      continue;
    const duplicate = selected.find(candidate.title);
    if (duplicate)
      duplicate.seeds.push(
        ...candidate.seeds.filter(
          (seed) => !duplicate.seeds.some((s) => s.id === seed.id),
        ),
      );
    else {
      const copy = { ...candidate, seeds: [...candidate.seeds] };
      unique.push(copy);
      selected.add(copy);
    }
  }
  return rankLocally(
    profile,
    unique,
    movieGenres,
    movieGenreNames,
    previous,
    limit,
  );
}
export type RecommendationCursor = Record<string, number | null>;
export async function getRecommendationChunk(
  profile: TasteProfile,
  fallback: Title[],
  cursor: RecommendationCursor,
  signal: AbortSignal,
): Promise<
  RecommendationPool & { cursor: RecommendationCursor; hasMore: boolean }
> {
  const next = { ...cursor };
  const tasks: {
    key: string;
    seed?: Entry;
    load: () => Promise<{ results: Title[]; hasMore: boolean }>;
  }[] = [];
  if (cursor.bootstrap === undefined)
    tasks.push({
      key: "bootstrap",
      load: async () => ({
        results: fallback.length ? fallback : await movies(undefined, signal),
        hasMore: false,
      }),
    });
  const activeKeys = ["bootstrap"];
  if (tmdbEnabled()) {
    const turn = Number(cursor._turn || 0);
    const broad = profile.preferredGenres;
    const broadKey = `discover:${[...broad].sort((a, b) => a - b).join("|") || "all"}`;
    activeKeys.push(broadKey, ...profile.seeds.map((seed) => seed.title.id));
    if (cursor[broadKey] !== null)
      tasks.push({
        key: broadKey,
        load: () =>
          discoverMoviesForTastePage(broad, cursor[broadKey] || 1, signal),
      });
    const focusLanes = new Map<
      string,
      { genre: number; decade: number; quality: boolean }
    >();
    if (broad.length > 1)
      for (const seed of profile.seeds) {
        const year = Number(seed.title.year),
          decade = year ? Math.floor(year / 10) * 10 : 0;
        for (const genre of movieGenres(seed.title))
          for (const quality of [false, true]) {
            focusLanes.set(`focus:${genre}:${decade}:${Number(quality)}`, {
              genre,
              decade,
              quality,
            });
          }
      }
    activeKeys.push(...focusLanes.keys());
    const availableLanes = [...focusLanes].filter(
      ([key]) => cursor[key] !== null,
    );
    if (availableLanes.length) {
      const [key, focus] = availableLanes[turn % availableLanes.length];
      tasks.push({
        key,
        load: () =>
          discoverMoviesForTastePage([focus.genre], cursor[key] || 1, signal, {
            minYear: focus.decade || undefined,
            maxYear: focus.decade ? focus.decade + 19 : undefined,
            sortBy: focus.quality ? "vote_average.desc" : "popularity.desc",
          }),
      });
    }
    // A fair rotating budget rather than three permanently fixed references.
    const available = profile.seeds.filter(
      (seed) => cursor[seed.title.id] !== null,
    );
    const offset = Number(cursor._seedOffset || 0);
    for (let i = 0; i < Math.min(2, available.length); i++) {
      const seed = available[(offset + i) % available.length];
      tasks.push({
        key: seed.title.id,
        seed,
        load: () =>
          relatedMoviesPage(seed.title, cursor[seed.title.id] || 1, signal),
      });
    }
    next._seedOffset = available.length
      ? (offset + Math.min(2, available.length)) % available.length
      : 0;
    next._turn = turn + 1;
  }
  const settled = await Promise.allSettled(tasks.map((t) => t.load()));
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const pool = new Map<string, Candidate>();
  let failed = 0;
  let firstError: unknown;
  settled.forEach((r, i) => {
    const task = tasks[i];
    if (r.status === "rejected") {
      failed++;
      firstError ??= r.reason;
      return;
    }
    next[task.key] = r.value.hasMore ? (cursor[task.key] || 1) + 1 : null;
    r.value.results.forEach((title, rank) => {
      if (title.kind !== "movie") return;
      const current = pool.get(title.id) || { title, seeds: [] };
      if (task.seed && !current.seeds.some((s) => s.id === task.seed!.title.id))
        current.seeds.push({
          id: task.seed.title.id,
          name: task.seed.title.name,
          rank,
        });
      pool.set(title.id, current);
    });
  });
  if (failed === tasks.length && failed) throw firstError;
  return {
    candidates: [...pool.values()],
    cursor: next,
    hasMore: activeKeys.some((k) => next[k] !== null),
    warning: failed ? "Une source est temporairement indisponible." : "",
  };
}

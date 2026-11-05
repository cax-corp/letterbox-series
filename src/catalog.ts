import { serviceDefaults } from "./service-config";
export type Season = { number: number; name: string; count: number };
export type Episode = {
  id: number;
  season: number;
  number: number;
  name: string;
};
export type Title = {
  id: string;
  kind: "movie" | "series";
  name: string;
  original?: string;
  year: string;
  image: string;
  backdrop?: string;
  summary: string;
  genres: string[];
  genreIds?: number[];
  score?: number;
  voteCount?: number;
  duration?: string;
  url?: string;
  trailer?: string;
  source?: "tmdb" | "itunes" | "tvmaze";
  trailerKind?: "video" | "youtube";
  imdbUrl?: string;
  seasons?: Season[];
  episodeCount?: number;
};
export type CatalogPage = {
  results: Title[];
  total: number;
  hasMore: boolean;
  page: number;
};
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&");
const TMDB = "https://api.themoviedb.org/3";
const genres: Record<number, string> = {
  28: "Action",
  12: "Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  14: "Fantastique",
  36: "Histoire",
  27: "Horreur",
  10402: "Musique",
  9648: "Mystère",
  10749: "Romance",
  878: "Science-fiction",
  10770: "Téléfilm",
  53: "Thriller",
  10752: "Guerre",
  37: "Western",
  10759: "Action & aventure",
  10762: "Enfants",
  10763: "Actualités",
  10764: "Télé-réalité",
  10765: "Science-fiction & fantastique",
  10766: "Feuilleton",
  10767: "Talk-show",
  10768: "Guerre & politique",
};
export function getTmdbCredential(): string {
  try {
    const saved = localStorage.getItem("luma-tmdb-token")?.trim();
    if (saved) return saved;
  } catch {
    /* The bundled catalogue also works if browser storage is unavailable. */
  }
  return serviceDefaults.tmdb;
}
export function tmdbEnabled() {
  return Boolean(getTmdbCredential().trim());
}
export function isTmdb(title: Title) {
  return /^tmdb-(movie|series)-\d+$/.test(title.id);
}
export function scoreSource(title: Title) {
  return isTmdb(title) ? "TMDB" : "TVmaze";
}
export async function request(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal });
  if (!r.ok)
    throw new Error(
      `Le catalogue ne répond pas (${r.status}). Réessayez dans un instant.`,
    );
  return r.json();
}
async function tmdb(
  path: string,
  params: Record<string, string | number> = {},
  signal?: AbortSignal,
  credential = getTmdbCredential(),
): Promise<any> {
  if (!credential.trim())
    throw new Error(
      "Activez TMDB dans Réglages → Catalogue avec votre clé gratuite.",
    );
  const url = new URL(TMDB + path);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (/^[a-f0-9]{32}$/i.test(credential))
    url.searchParams.set("api_key", credential);
  else headers.Authorization = `Bearer ${credential}`;
  let r: Response;
  try {
    r = await fetch(url, { signal, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "Impossible de joindre TMDB. Vérifiez votre connexion et réessayez.",
    );
  }
  if (!r.ok) {
    if (r.status === 401 || r.status === 403)
      throw new Error(
        "TMDB refuse la clé. Vérifiez votre jeton de lecture ou votre clé API dans Réglages → Catalogue.",
      );
    if (r.status === 429)
      throw new Error(
        "TMDB reçoit trop de demandes. Patientez quelques instants puis réessayez.",
      );
    throw new Error(
      `TMDB est indisponible (${r.status}). Réessayez dans un instant.`,
    );
  }
  return r.json();
}
export async function saveTmdbCredential(input: string) {
  const credential = input.trim().replace(/^Bearer\s+/i, "");
  if (
    !/^[a-f0-9]{32}$/i.test(credential) &&
    !/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(credential)
  )
    throw new Error(
      "Collez le jeton de lecture API TMDB ou la clé API v3 de 32 caractères.",
    );
  await tmdb("/configuration", {}, undefined, credential);
  localStorage.setItem("luma-tmdb-token", credential);
  location.reload();
}
export function disableTmdb() {
  localStorage.removeItem("luma-tmdb-token");
  location.reload();
}
function fromTmdb(x: any, kind: Title["kind"]): Title {
  const trailer = (x.videos?.results || []).find(
    (v: any) =>
      v.site === "YouTube" && v.type === "Trailer" && /^[\w-]+$/.test(v.key),
  );
  const imdb = x.external_ids?.imdb_id || x.imdb_id;
  return {
    id: `tmdb-${kind}-${x.id}`,
    source: "tmdb",
    kind,
    name:
      x.title || x.name || x.original_title || x.original_name || "Sans titre",
    original: x.original_title || x.original_name,
    year: (x.release_date || x.first_air_date || "").slice(0, 4),
    image: x.poster_path
      ? `https://image.tmdb.org/t/p/w500${x.poster_path}`
      : "",
    backdrop: x.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${x.backdrop_path}`
      : undefined,
    summary: x.overview || "Synopsis indisponible en français.",
    genreIds: x.genres ? x.genres.map((g: any) => g.id) : x.genre_ids || [],
    genres: x.genres
      ? x.genres.map((g: any) => g.name)
      : (x.genre_ids || []).map((id: number) => genres[id]).filter(Boolean),
    voteCount: x.vote_count,
    score: x.vote_count > 0 ? Math.round(x.vote_average * 10) / 10 : undefined,
    duration: x.runtime
      ? `${x.runtime} min`
      : x.episode_run_time?.[0]
        ? `${x.episode_run_time[0]} min / épisode`
        : undefined,
    url: `https://www.themoviedb.org/${kind === "movie" ? "movie" : "tv"}/${x.id}`,
    trailer: trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : undefined,
    trailerKind: trailer ? "youtube" : undefined,
    imdbUrl:
      typeof imdb === "string" && /^tt\d+$/.test(imdb)
        ? `https://www.imdb.com/title/${imdb}/`
        : undefined,
    seasons: Array.isArray(x.seasons)
      ? x.seasons.map((s: any) => ({
          number: s.season_number,
          name: s.name || `Saison ${s.season_number}`,
          count: s.episode_count || 0,
        }))
      : undefined,
    episodeCount: x.number_of_episodes,
  };
}
export async function movies(
  term?: string,
  signal?: AbortSignal,
): Promise<Title[]> {
  if (tmdbEnabled()) {
    const d = await tmdb(
      term ? "/search/movie" : "/trending/movie/week",
      term ? { query: term, include_adult: "false", page: 1 } : { page: 1 },
      signal,
    );
    return d.results.map((x: any) => fromTmdb(x, "movie"));
  }
  return legacyMovies(term || "science fiction", signal);
}
export async function series(
  term?: string,
  signal?: AbortSignal,
): Promise<Title[]> {
  if (tmdbEnabled()) {
    const d = await tmdb(
      term ? "/search/tv" : "/trending/tv/week",
      term ? { query: term, include_adult: "false", page: 1 } : { page: 1 },
      signal,
    );
    return d.results.map((x: any) => fromTmdb(x, "series"));
  }
  return legacySeries(term, signal);
}
export async function searchCatalog(
  query: string,
  kind: "all" | "movie" | "series",
  page = 1,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  if (!tmdbEnabled()) {
    const r = await Promise.allSettled([
      kind !== "series" ? legacyMovies(query, signal) : Promise.resolve([]),
      kind !== "movie" ? legacySeries(query, signal) : Promise.resolve([]),
    ]);
    const results = r.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    if (r.some((x) => x.status === "rejected"))
      throw new Error(
        "Un catalogue limité est indisponible. Activez TMDB dans les réglages ou réessayez.",
      );
    return { results, total: results.length, hasMore: false, page: 1 };
  }
  const types = kind === "all" ? (["movie", "series"] as const) : [kind];
  const data = await Promise.all(
    types.map(async (k) => {
      const d = await tmdb(
        `/search/${k === "movie" ? "movie" : "tv"}`,
        { query, include_adult: "false", page },
        signal,
      );
      return {
        results: d.results.map((x: any) => fromTmdb(x, k)),
        total: d.total_results || 0,
        pages: Math.min(d.total_pages || 0, 500),
      };
    }),
  );
  // Interleave films and TV without discarding results lacking a poster.
  const results: Title[] = [];
  for (let i = 0; i < Math.max(...data.map((d) => d.results.length)); i++)
    for (const d of data) if (d.results[i]) results.push(d.results[i]);
  return {
    results,
    total: data.reduce((n, d) => n + d.total, 0),
    hasMore: data.some((d) => page < d.pages),
    page,
  };
}
export async function getTitleDetails(
  title: Title,
  signal?: AbortSignal,
): Promise<Title> {
  if (!isTmdb(title)) return title;
  const id = title.id.split("-")[2];
  const d = await tmdb(
    `/${title.kind === "movie" ? "movie" : "tv"}/${id}`,
    { append_to_response: "videos,external_ids" },
    signal,
  );
  return fromTmdb(d, title.kind);
}
export async function seasonEpisodes(
  title: Title,
  season: number,
  signal?: AbortSignal,
): Promise<Episode[]> {
  if (!isTmdb(title)) throw new Error("Source de saison incorrecte");
  const d = await tmdb(
    `/tv/${title.id.split("-")[2]}/season/${season}`,
    {},
    signal,
  );
  return (d.episodes || []).map((x: any) => ({
    id: x.id,
    season: x.season_number,
    number: x.episode_number,
    name: x.name || `Épisode ${x.episode_number}`,
  }));
}
export async function episodes(
  id: string,
  signal?: AbortSignal,
): Promise<Episode[]> {
  if (!/^series-\d+$/.test(id))
    throw new Error("Cette source nécessite le chargement par saison.");
  return request(
    `https://api.tvmaze.com/shows/${id.replace("series-", "")}/episodes`,
    signal,
  );
}
// Keep the old providers for saved entries and for installations without TMDB configuration.
async function legacyMovies(
  term: string,
  signal?: AbortSignal,
): Promise<Title[]> {
  const d = await request(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=movie&country=fr&limit=40`,
    signal,
  );
  return d.results.map((x: any) => ({
    id: `movie-${x.trackId}`,
    source: "itunes",
    kind: "movie",
    name: x.trackName,
    original: x.artistName,
    year: (x.releaseDate || "").slice(0, 4),
    image: (x.artworkUrl100 || "").replace("100x100bb", "600x900bb"),
    summary:
      x.longDescription || x.shortDescription || "Synopsis indisponible.",
    genres: [x.primaryGenreName].filter(Boolean),
    duration: x.trackTimeMillis
      ? `${Math.round(x.trackTimeMillis / 60000)} min`
      : undefined,
    url: x.trackViewUrl,
    trailer: x.previewUrl,
    trailerKind: "video",
  }));
}
async function legacySeries(
  term?: string,
  signal?: AbortSignal,
): Promise<Title[]> {
  const d = await request(
    term
      ? `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(term)}`
      : "https://api.tvmaze.com/shows?page=1",
    signal,
  );
  return (term ? d.map((x: any) => x.show) : d)
    .map((x: any): Title => ({
      id: `series-${x.id}`,
      source: "tvmaze",
      kind: "series",
      name: x.name,
      year: (x.premiered || "").slice(0, 4),
      image: x.image?.original || "",
      summary: plain(x.summary || "Synopsis indisponible."),
      genres: x.genres || [],
      score: x.rating?.average,
      duration: x.averageRuntime
        ? `${x.averageRuntime} min / épisode`
        : undefined,
      url: x.officialSite || x.url,
    }))
    .sort((a: Title, b: Title) => (b.score || 0) - (a.score || 0));
}

export type MoviePage = { results: Title[]; hasMore: boolean };
const resolvedSeeds = new Map<string, Title>();
export async function relatedMoviesPage(
  seed: Title,
  page: number,
  signal?: AbortSignal,
): Promise<MoviePage> {
  if (seed.kind !== "movie" || !tmdbEnabled())
    return { results: [], hasMore: false };
  const key = JSON.stringify([seed.id, seed.name, seed.year]);
  let resolved = isTmdb(seed) ? seed : resolvedSeeds.get(key);
  if (!resolved) {
    const result = await searchCatalog(seed.name, "movie", 1, signal);
    const norm = (v: string) =>
      v
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const exact = result.results.filter(
      (t) =>
        [t.name, t.original || ""].some((n) => norm(n) === norm(seed.name)) &&
        (!seed.year || t.year === seed.year),
    );
    if (exact.length !== 1) return { results: [], hasMore: false };
    resolved = exact[0];
    resolvedSeeds.set(key, resolved);
  }
  const d = await tmdb(
    `/movie/${resolved.id.split("-")[2]}/recommendations`,
    { page },
    signal,
  );
  return {
    results: (d.results || [])
      .filter((x: any) => !x.adult)
      .map((x: any) => fromTmdb(x, "movie")),
    hasMore: page < Math.min(d.total_pages || 1, 500),
  };
}
export async function discoverMoviesForTastePage(
  genreIds: number[],
  page: number,
  signal?: AbortSignal,
  options: {
    minYear?: number;
    maxYear?: number;
    sortBy?: "popularity.desc" | "vote_average.desc";
  } = {},
): Promise<MoviePage> {
  const d = await tmdb(
    "/discover/movie",
    {
      include_adult: "false",
      include_video: "false",
      sort_by: options.sortBy || "popularity.desc",
      ...(options.minYear
        ? { "primary_release_date.gte": `${options.minYear}-01-01` }
        : {}),
      ...(options.maxYear
        ? { "primary_release_date.lte": `${options.maxYear}-12-31` }
        : {}),
      "vote_count.gte": 50,
      ...(genreIds.length ? { with_genres: genreIds.join("|") } : {}),
      page,
    },
    signal,
  );
  return {
    results: (d.results || [])
      .filter((x: any) => !x.adult)
      .map((x: any) => fromTmdb(x, "movie")),
    hasMore: page < Math.min(d.total_pages || 1, 500),
  };
}
export async function relatedMovies(seed: Title, signal?: AbortSignal) {
  return (await relatedMoviesPage(seed, 1, signal)).results;
}
export async function discoverMoviesForTaste(
  genreIds: number[],
  signal?: AbortSignal,
) {
  return (await discoverMoviesForTastePage(genreIds, 1, signal)).results;
}

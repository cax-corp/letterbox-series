import { t as tr, getLanguage } from "./i18n";
import { tmdbRequest, isTmdb, type Title } from "./catalog";
export type Provider = { id: number; name: string; logo: string };
export type WatchOffers = {
  country: string;
  link: string;
  flatrate: Provider[];
  free: Provider[];
  ads: Provider[];
  rent: Provider[];
  buy: Provider[];
  checkedAt: number;
};
export const offerKinds = ["flatrate", "free", "ads", "rent", "buy"] as const;
const cache = new Map<string, { at: number; data: unknown }>();
const HOUR = 3600000;
function fromProvider(p: any): Provider | null {
  return Number.isSafeInteger(p?.provider_id) &&
    p.provider_id > 0 &&
    typeof p.provider_name === "string"
    ? {
        id: p.provider_id,
        name: p.provider_name,
        logo:
          typeof p.logo_path === "string" && /^\/[\w./-]+$/.test(p.logo_path)
            ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
            : "",
      }
    : null;
}
function providers(rows: unknown): Provider[] {
  const result = new Map<number, Provider>();
  if (Array.isArray(rows))
    for (const row of rows) {
      const p = fromProvider(row);
      if (p) result.set(p.id, p);
    }
  return [...result.values()];
}
function remembered<T>(key: string, ttl: number): T | null {
  const v = cache.get(key);
  if (v && Date.now() - v.at < ttl) return v.data as T;
  return null;
}
export async function providerCatalog(
  country: string,
  signal: AbortSignal,
): Promise<Provider[]> {
  if (!/^[A-Z]{2}$/.test(country)) return [];
  const key = "providers:" + country + ":" + getLanguage(),
    saved = remembered<Provider[]>(key, 24 * HOUR);
  if (saved) return saved;
  const responses = await Promise.all([
    tmdbRequest("/watch/providers/movie", { watch_region: country }, signal),
    tmdbRequest("/watch/providers/tv", { watch_region: country }, signal),
  ]);
  const result = new Map<number, Provider>();
  for (const r of responses)
    for (const p of providers(r.results)) result.set(p.id, p);
  const data = [...result.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  cache.set(key, { at: Date.now(), data });
  return data;
}
export async function watchOffers(
  title: Title,
  country: string,
  signal: AbortSignal,
): Promise<WatchOffers> {
  if (!isTmdb(title))
    throw new Error(
      tr(
        "Disponibilités non renseignées pour cette ancienne source. Retrouvez le titre via la recherche TMDB.",
      ),
    );
  if (!/^[A-Z]{2}$/.test(country))
    throw new Error(tr("Choisissez votre pays dans les réglages."));
  const key = title.id + ":" + country + ":" + getLanguage(),
    saved = remembered<WatchOffers>(key, 6 * HOUR);
  if (saved) return saved;
  const kind = title.kind === "movie" ? "movie" : "tv";
  const result = await tmdbRequest(
      `/${kind}/${title.id.split("-")[2]}/watch/providers`,
      {},
      signal,
    ),
    region = result.results?.[country];
  let link = "";
  try {
    const u = new URL(region?.link);
    if (
      u.protocol === "https:" &&
      ["www.themoviedb.org", "themoviedb.org"].includes(u.hostname)
    )
      link = u.href;
  } catch {}
  const data: WatchOffers = {
    country,
    link,
    flatrate: providers(region?.flatrate),
    free: providers(region?.free),
    ads: providers(region?.ads),
    rent: providers(region?.rent),
    buy: providers(region?.buy),
    checkedAt: Date.now(),
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

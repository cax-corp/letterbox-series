import type { Title } from "./catalog";
export type DirectWatchLink = { url: string; host: string };
const trusted = [
  "netflix.com",
  "primevideo.com",
  "amazon.com",
  "amazon.fr",
  "amazon.de",
  "amazon.co.uk",
  "amazon.it",
  "amazon.es",
  "disneyplus.com",
  "tv.apple.com",
  "max.com",
  "play.max.com",
  "hbomax.com",
  "hulu.com",
  "paramountplus.com",
  "canalplus.com",
  "crunchyroll.com",
  "arte.tv",
  "france.tv",
  "mubi.com",
  "peacocktv.com",
  "rakuten.tv",
];
export function safeWatchLink(value: string): DirectWatchLink | null {
  try {
    const u = new URL(value);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    if (
      u.hostname.replace(/^www\./, "").startsWith("amazon.") &&
      !/^\/gp\/video\/detail\//.test(u.pathname)
    )
      return null;
    if (
      !trusted.some(
        (host) => u.hostname === host || u.hostname === "www." + host,
      )
    )
      return null;
    if (
      u.pathname === "/" ||
      /\/(?:search|login|signup|browse|home)\/?$/i.test(u.pathname)
    )
      return null;
    u.protocol = "https:";
    return { url: u.href, host: u.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
export function providerDirectLink(name: string, links: DirectWatchLink[]) {
  const n = name.toLowerCase();
  const domains = n.includes("netflix")
    ? ["netflix.com"]
    : n.includes("amazon") || n.includes("prime video")
      ? ["primevideo.com", "amazon."]
      : n.includes("disney")
        ? ["disneyplus.com"]
        : n.includes("apple tv")
          ? ["tv.apple.com"]
          : /\b(?:hbo|max)\b/.test(n)
            ? ["max.com", "play.max.com", "hbomax.com"]
            : n.includes("paramount")
              ? ["paramountplus.com"]
              : n.includes("canal")
                ? ["canalplus.com"]
                : n.includes("crunchyroll")
                  ? ["crunchyroll.com"]
                  : n.includes("arte")
                    ? ["arte.tv"]
                    : n.includes("france")
                      ? ["france.tv"]
                      : n.includes("mubi")
                        ? ["mubi.com"]
                        : n.includes("hulu")
                          ? ["hulu.com"]
                          : n.includes("peacock")
                            ? ["peacocktv.com"]
                            : n.includes("rakuten")
                              ? ["rakuten.tv"]
                              : [];
  return links.find((link) =>
    domains.some((d) =>
      d === "amazon." ? link.host.startsWith("amazon.") : link.host === d,
    ),
  )?.url;
}
let cooldownUntil = 0;
const memory = new Map<string, { at: number; links: DirectWatchLink[] }>();
const prefix = "vela-direct-links-v1:";
export async function directWatchLinks(
  title: Title,
  signal: AbortSignal,
): Promise<DirectWatchLink[]> {
  const id = /^tmdb-(movie|series)-(\d+)$/.exec(title.id),
    imdb = /\/title\/(tt\d+)\//.exec(title.imdbUrl || "");
  const official = safeWatchLink(title.homepage || title.url || "");
  if (!id) return official ? [official] : [];
  let saved = memory.get(title.id);
  try {
    saved ||= JSON.parse(localStorage.getItem(prefix + title.id) || "null");
  } catch {}
  if (
    saved &&
    Array.isArray(saved.links) &&
    Number.isFinite(saved.at) &&
    Date.now() - saved.at < 86400000 * (saved.links.length ? 7 : 1)
  ) {
    return [...(official ? [official] : []), ...saved.links]
      .map((l) => safeWatchLink(l.url))
      .filter((l): l is DirectWatchLink => Boolean(l));
  }
  if (Date.now() < cooldownUntil) {
    if (official) return [official];
    throw new Error("Liens temporairement indisponibles.");
  }
  const lookups = `(wdt:${id[1] === "movie" ? "P4947" : "P4983"} "${id[2]}")${imdb ? ` (wdt:P345 "${imdb[1]}")` : ""}`;
  const query = `PREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX wikibase: <http://wikiba.se/ontology#>\nSELECT DISTINCT ?identifier ?formatter WHERE { VALUES (?lookup ?key) { ${lookups} } ?work ?lookup ?key. ?work ?predicate ?identifier. ?property wikibase:directClaim ?predicate; wdt:P1630 ?formatter. FILTER(isLiteral(?identifier)) FILTER(REGEX(STR(?formatter), "netflix|primevideo|amazon|disneyplus|tv.apple|max.com|hbomax|hulu|paramountplus|canalplus|crunchyroll|arte.tv|france.tv|mubi|peacocktv|rakuten.tv", "i")) } LIMIT 100`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const c = new AbortController(),
    stop = () => c.abort();
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) c.abort();
  const timer = setTimeout(stop, 8000);
  try {
    const response = await fetch(url, {
      signal: c.signal,
      headers: { Accept: "application/sparql-results+json" },
    });
    if (!response.ok) {
      if ([429, 503].includes(response.status))
        cooldownUntil = Date.now() + 60000;
      if (official) return [official];
      throw new Error("Les liens directs ne sont pas joignables.");
    }
    const data = await response.json();
    const links = new Map<string, DirectWatchLink>();
    for (const row of data.results?.bindings || []) {
      if (
        typeof row.formatter?.value !== "string" ||
        typeof row.identifier?.value !== "string"
      )
        continue;
      const link = safeWatchLink(
        row.formatter.value.replaceAll(
          "$1",
          encodeURIComponent(row.identifier.value),
        ),
      );
      if (link) links.set(link.url, link);
    }
    const saved = { at: Date.now(), links: [...links.values()] };
    memory.set(title.id, saved);
    try {
      localStorage.setItem(prefix + title.id, JSON.stringify(saved));
    } catch {}
    return official
      ? [official, ...saved.links.filter((l) => l.url !== official.url)]
      : saved.links;
  } catch (error) {
    if (official && !signal.aborted) return [official];
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}

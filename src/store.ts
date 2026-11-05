import { createClient } from "@supabase/supabase-js";
import { serviceDefaults } from "./service-config";
import type { Title } from "./catalog";
export type Entry = {
  title: Title;
  watchlist: boolean;
  watched: boolean;
  rating: number;
  review: string;
  favorite: boolean;
  updated: string;
  preferenceUpdated?: string;
  watchedAt: string;
  episodes: number[];
  lists?: string[];
  recommendationFeedback?: "like" | "dislike";
};
export function parseCollection(json: string): Record<string, Entry> {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Collection invalide");
  for (const [id, value] of Object.entries(data)) {
    const v = value as Entry;
    if (
      !v ||
      !v.title ||
      v.title.id !== id ||
      !/^(?:tmdb-)?(movie|series)-[0-9]+$/.test(id) ||
      !["movie", "series"].includes(v.title.kind) ||
      !["name", "year", "image", "summary"].every(
        (k) => typeof v.title[k as keyof Title] === "string",
      ) ||
      (v.title.genreIds !== undefined &&
        (!Array.isArray(v.title.genreIds) ||
          !v.title.genreIds.every(Number.isInteger))) ||
      (v.title.voteCount !== undefined &&
        (!Number.isInteger(v.title.voteCount) || v.title.voteCount < 0)) ||
      !Array.isArray(v.title.genres) ||
      !v.title.genres.every((x) => typeof x === "string") ||
      (v.title.seasons !== undefined &&
        (!Array.isArray(v.title.seasons) ||
          !v.title.seasons.every(
            (s) =>
              Number.isInteger(s.number) &&
              s.number >= 0 &&
              Number.isInteger(s.count) &&
              s.count >= 0 &&
              typeof s.name === "string",
          ))) ||
      typeof v.updated !== "string" ||
      !Number.isFinite(Date.parse(v.updated)) ||
      (v.preferenceUpdated !== undefined &&
        (typeof v.preferenceUpdated !== "string" ||
          !Number.isFinite(Date.parse(v.preferenceUpdated)))) ||
      (v.recommendationFeedback !== undefined &&
        !["like", "dislike"].includes(v.recommendationFeedback)) ||
      typeof v.review !== "string" ||
      v.review.length > 5000 ||
      !Number.isFinite(v.rating) ||
      v.rating < 0 ||
      v.rating > 5 ||
      !Array.isArray(v.episodes) ||
      !v.episodes.every(Number.isInteger) ||
      (v.lists !== undefined &&
        (!Array.isArray(v.lists) ||
          !v.lists.every((x) => typeof x === "string"))) ||
      !["watchlist", "watched", "favorite"].every(
        (k) => typeof v[k as keyof Entry] === "boolean",
      ) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.watchedAt)
    )
      throw new Error("Collection invalide");
  }
  return data as Record<string, Entry>;
}
const key = "luma-library-v1";
export function read(user?: string): Record<string, Entry> {
  try {
    return parseCollection(
      localStorage.getItem(user ? `${key}-${user}` : key) || "{}",
    );
  } catch {
    return {};
  }
}
export function write(data: Record<string, Entry>, user?: string) {
  localStorage.setItem(user ? `${key}-${user}` : key, JSON.stringify(data));
}
export const empty = (title: Title): Entry => ({
  title,
  watchlist: false,
  watched: false,
  rating: 0,
  review: "",
  favorite: false,
  updated: new Date().toISOString(),
  watchedAt: new Date().toISOString().slice(0, 10),
  episodes: [],
});
export function getConfig(): { url: string; key: string } {
  const fallback = { url: serviceDefaults.url, key: serviceDefaults.key };
  try {
    const saved = JSON.parse(localStorage.getItem("luma-cloud") || "null");
    if (
      saved &&
      typeof saved.url === "string" &&
      /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(saved.url.trim()) &&
      typeof saved.key === "string" &&
      saved.key.trim()
    ) {
      return { url: saved.url.trim(), key: saved.key.trim() };
    }
  } catch {
    /* A damaged or inaccessible preference must not prevent startup. */
  }
  return fallback;
}
const c = getConfig();
export const cloud = c.url && c.key ? createClient(c.url, c.key) : null;
export function saveConfig(url: string, key: string) {
  if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(url.trim()))
    throw new Error("Utilisez l’URL HTTPS de votre projet Supabase.");
  if (!key.trim()) throw new Error("La clé publique est nécessaire.");
  if (key.startsWith("sb_secret_"))
    throw new Error("Utilisez uniquement une clé publique.");
  try {
    const payload = JSON.parse(atob(key.split(".")[1]));
    if (payload.role === "service_role") throw new Error("private");
  } catch (e) {
    if (e instanceof Error && e.message === "private")
      throw new Error(
        "La clé service_role ne doit jamais être utilisée dans Vela.",
      );
  }
  localStorage.setItem(
    "luma-cloud",
    JSON.stringify({ url: url.trim(), key: key.trim() }),
  );
  location.reload();
}
export type Library = Record<string, Entry>;
/** Local wins ties; timestamps are parsed rather than compared as formatted strings. */
export function mergeCollections(local: Library, remote: Library): Library {
  const merged = { ...remote };
  for (const [id, entry] of Object.entries(local)) {
    if (
      !merged[id] ||
      Date.parse(entry.updated) >= Date.parse(merged[id].updated)
    )
      merged[id] = entry;
  }
  return merged;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export type SyncResult = { library: Library; uploaded: number };
/** One paginated read, then only rows absent or changed in the cloud are uploaded. */
export async function sync(
  user: string,
  local: Library,
  client = cloud,
): Promise<SyncResult> {
  if (!client)
    throw new Error("Configurez Supabase pour sauvegarder votre collection.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const remote: Library = {};
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from("library")
        .select("entry")
        .eq("user_id", user)
        .order("title_id", { ascending: true })
        .range(offset, offset + pageSize - 1)
        .abortSignal(controller.signal)
        .retry(false);
      if (error) throw error;
      for (const row of data || []) {
        const entry = row.entry as Entry;
        if (!entry?.title?.id)
          throw new Error("Une entrée de la sauvegarde est invalide.");
        Object.assign(
          remote,
          parseCollection(JSON.stringify({ [entry.title.id]: entry })),
        );
      }
      if (!data || data.length < pageSize) break;
    }
    const merged = mergeCollections(local, remote);
    const changed = Object.values(merged).filter(
      (entry) =>
        !remote[entry.title.id] ||
        canonical(entry) !== canonical(remote[entry.title.id]),
    );
    for (let offset = 0; offset < changed.length; offset += 100) {
      const { error } = await client
        .from("library")
        .upsert(
          changed.slice(offset, offset + 100).map((entry) => ({
            user_id: user,
            title_id: entry.title.id,
            entry,
          })),
          { onConflict: "user_id,title_id" },
        )
        .abortSignal(controller.signal)
        .retry(false);
      if (error) throw error;
    }
    return { library: merged, uploaded: changed.length };
  } finally {
    clearTimeout(timeout);
  }
}

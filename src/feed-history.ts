import type { Title } from "./catalog";
import type { Suggestion } from "./recommendations";
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const prefix = "luma-feed-seen-v2:";
type Ledger = { ids: string[]; aliases: string[]; trail?: Title[] };
const memory = new Map<string, Ledger>();
const normal = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function aliases(title: Title) {
  return [
    title.name,
    ...(title.source === "tmdb" && title.original ? [title.original] : []),
  ]
    .map(normal)
    .filter(Boolean)
    .map((name) => `${title.kind}|${title.year}|${name}`);
}
function readLedger(account: string, date = new Date()): Ledger {
  const key = `${prefix}${account}:${localDay(date)}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.ids) && Array.isArray(data.aliases)) {
        const value = {
          trail: Array.isArray(data.trail)
            ? data.trail
                .filter(
                  (t: any) =>
                    t &&
                    typeof t.id === "string" &&
                    typeof t.name === "string" &&
                    typeof t.summary === "string" &&
                    Array.isArray(t.genres),
                )
                .slice(-12)
            : [],
          ids: data.ids.filter((s: unknown) => typeof s === "string"),
          aliases: data.aliases.filter((s: unknown) => typeof s === "string"),
        };
        memory.set(key, value);
        return value;
      }
    }
    // Upgrade conservatively: undated impressions from 1.5 are excluded for the rest of today.
    const oldKey = `luma-feed-recent-v1:${account}`;
    const old = JSON.parse(localStorage.getItem(oldKey) || "[]");
    if (Array.isArray(old) && old.length) {
      const ledger = {
        ids: old.filter((s: unknown) => typeof s === "string"),
        aliases: [],
      };
      localStorage.setItem(key, JSON.stringify(ledger));
      localStorage.removeItem(oldKey);
      memory.set(key, ledger);
      return ledger;
    }
  } catch {
    /* The in-process ledger still prevents repetition when storage is unavailable. */
  }
  return memory.get(key) || { ids: [], aliases: [] };
}
export function readFeedHistory(
  account = "local",
  date = new Date(),
): string[] {
  return readLedger(account, date).ids;
}
export function wasSuggestedToday(
  title: Title,
  account = "local",
  date = new Date(),
) {
  const ledger = readLedger(account, date);
  return (
    ledger.ids.includes(title.id) ||
    aliases(title).some((alias) => ledger.aliases.includes(alias))
  );
}
export function rememberSuggestion(
  title: Title | string,
  account = "local",
  date = new Date(),
): boolean {
  const day = localDay(date),
    key = `${prefix}${account}:${day}`;
  const old = readLedger(account, date),
    id = typeof title === "string" ? title : title.id;
  const ledger = {
    trail:
      typeof title === "string"
        ? old.trail || []
        : [...(old.trail || []).filter((t) => t.id !== title.id), title].slice(
            -12,
          ),
    ids: [...new Set([...old.ids, id])],
    aliases: [
      ...new Set([
        ...old.aliases,
        ...(typeof title === "string" ? [] : aliases(title)),
      ]),
    ],
  };
  memory.set(key, ledger);
  try {
    localStorage.setItem(key, JSON.stringify(ledger));
    for (const previous of Object.keys(localStorage))
      if (previous.startsWith(prefix + account + ":") && previous !== key)
        localStorage.removeItem(previous);
    if (!old.ids.includes(id) && typeof window !== "undefined")
      window.dispatchEvent(new Event("luma-feed-impression"));
    return true;
  } catch {
    return false;
  }
}
/** Strict daily exclusion: never recycle impressions to fill an exhausted catalogue. */
export function freshSuggestions(ranked: Suggestion[], recent: string[]) {
  const seen = new Set(recent);
  return ranked.filter((item) => !seen.has(item.title.id));
}

export function dailyExclusion(account = "local", date = new Date()) {
  const ledger = readLedger(account, date),
    ids = new Set(ledger.ids),
    names = new Set(ledger.aliases);
  return (title: Title) =>
    ids.has(title.id) || aliases(title).some((alias) => names.has(alias));
}
export function readFeedTrail(account = "local") {
  return readLedger(account).trail || [];
}

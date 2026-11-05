import type { Title } from "./catalog";
import { localDay } from "./feed-history";
export const QUICK_SKIP_MIN_MS = 350,
  QUICK_SKIP_MAX_MS = 3000;
const DAY = 86400000,
  MAX_AGE = 30 * DAY,
  MAX_SIGNALS = 120;
const key = (account: string) => `vela-implicit-skips-v1:${account}`;
export type SkipSignal = { title: Title; strength: number };
type StoredSkip = { title: Title; at: number; dwell: number };
function stored(account: string, now: number): StoredSkip[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(key(account)) || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (s): s is StoredSkip =>
          s?.title?.kind === "movie" &&
          /^(?:tmdb-)?movie-\d+$/.test(s.title.id) &&
          typeof s.title.name === "string" &&
          typeof s.title.year === "string" &&
          typeof s.title.summary === "string" &&
          Array.isArray(s.title.genres) &&
          s.title.genres.every((g: unknown) => typeof g === "string") &&
          (s.title.genreIds === undefined ||
            (Array.isArray(s.title.genreIds) &&
              s.title.genreIds.every(Number.isInteger))) &&
          Number.isFinite(s.at) &&
          s.at <= now &&
          now - s.at <= MAX_AGE &&
          Number.isFinite(s.dwell) &&
          s.dwell >= QUICK_SKIP_MIN_MS &&
          s.dwell < QUICK_SKIP_MAX_MS,
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_SIGNALS);
  } catch {
    return [];
  }
}
export function readSkipSignals(
  account = "local",
  now = Date.now(),
): SkipSignal[] {
  return stored(account, now).map((s) => ({
    title: s.title,
    strength:
      (0.06 + 0.08 * (1 - s.dwell / QUICK_SKIP_MAX_MS)) *
      2 ** (-(now - s.at) / (7 * DAY)),
  }));
}
/** Separate from the collection: no rating, explicit rejection or cloud write is created. */
export function rememberQuickSkip(
  title: Title,
  dwell: number,
  account = "local",
  now = Date.now(),
): boolean {
  if (
    title.kind !== "movie" ||
    dwell < QUICK_SKIP_MIN_MS ||
    dwell >= QUICK_SKIP_MAX_MS ||
    !Number.isFinite(dwell)
  )
    return false;
  const previous = stored(account, now);
  if (
    previous.some(
      (s) =>
        s.title.id === title.id &&
        localDay(new Date(s.at)) === localDay(new Date(now)),
    )
  )
    return false;
  const minimal: Title = {
    id: title.id,
    kind: title.kind,
    name: title.name,
    year: title.year,
    image: "",
    summary: title.summary.slice(0, 2500),
    genres: title.genres,
    ...(title.genreIds ? { genreIds: title.genreIds } : {}),
    ...(title.original ? { original: title.original } : {}),
    ...(title.source ? { source: title.source } : {}),
  };
  try {
    localStorage.setItem(
      key(account),
      JSON.stringify(
        [
          { title: minimal, at: now, dwell },
          ...previous.filter((s) => s.title.id !== title.id),
        ].slice(0, MAX_SIGNALS),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
type Exposure = {
  title: Title;
  index: number;
  elapsed: number;
  since: number | null;
  eligible: boolean;
};
/** Measures settled, visible exposure, never scroll-animation time or virtualized neighbours. */
export class QuickSkipTracker {
  private exposure: Exposure | null = null;
  private forward = false;
  private ignored = new Set<string>();
  intent(forward: boolean) {
    this.forward = forward;
  }
  engage(id: string) {
    this.ignored.add(id);
    if (this.exposure?.title.id === id) this.exposure.eligible = false;
  }
  suspend() {
    if (this.exposure) this.ignored.add(this.exposure.title.id);
    this.exposure = null;
    this.forward = false;
  }
  update(
    title: Title | undefined,
    index: number,
    moving: boolean,
    paused: boolean,
    now: number,
  ): { title: Title; dwell: number } | null {
    if (paused || !title) {
      this.suspend();
      return null;
    }
    const old = this.exposure;
    if (moving) {
      if (old?.since !== null && old?.since !== undefined) {
        old.elapsed += Math.max(0, now - old.since);
        old.since = null;
      }
      return null;
    }
    if (old?.title.id === title.id) {
      old.index = index;
      if (old.since === null) {
        old.since = now;
        this.forward = false;
      }
      return null;
    }
    const dwell = old
      ? old.elapsed + (old.since === null ? 0 : Math.max(0, now - old.since))
      : 0;
    if (old && dwell >= QUICK_SKIP_MAX_MS) this.ignored.add(old.title.id);
    const skipped =
      old &&
      this.forward &&
      index === old.index + 1 &&
      old.eligible &&
      dwell >= QUICK_SKIP_MIN_MS &&
      dwell < QUICK_SKIP_MAX_MS
        ? { title: old.title, dwell }
        : null;
    this.exposure = {
      title,
      index,
      elapsed: 0,
      since: now,
      eligible: !this.ignored.has(title.id),
    };
    this.forward = false;
    return skipped;
  }
}

import type { Title } from "./catalog";
type Exposure = { count: number; lastAt: number };
const key = (account: string) => `vela-home-exposures-v1:${account}`;
export function readHomeExposures(account = "local"): Record<string, Exposure> {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) || "{}");
    return Object.fromEntries(
      Object.entries(raw).filter(([id, value]) => {
        const v = value as Exposure;
        return (
          /^(tmdb-)?(movie|series)-\d+$/.test(id) &&
          Number.isFinite(v?.lastAt) &&
          Number.isInteger(v.count) &&
          v.count > 0
        );
      }),
    ) as Record<string, Exposure>;
  } catch {
    return {};
  }
}
/** A visible visit is an exposure, not a dislike and never a fabricated low rating. */
export function rememberHomeExposure(
  title: Title,
  account = "local",
  now = Date.now(),
) {
  const history = readHomeExposures(account),
    old = history[title.id];
  // Ignore quick back-and-forth and rerenders of the same visit.
  if (old && now - old.lastAt < 60000) return;
  history[title.id] = {
    count: Math.min(20, (old?.count || 0) + 1),
    lastAt: now,
  };
  try {
    localStorage.setItem(
      key(account),
      JSON.stringify(
        Object.fromEntries(
          Object.entries(history)
            .sort((a, b) => b[1].lastAt - a[1].lastAt)
            .slice(0, 100),
        ),
      ),
    );
  } catch {}
}
export function chooseHomeHero(
  titles: Title[],
  account = "local",
  now = Date.now(),
) {
  const history = readHomeExposures(account);
  return titles
    .slice(0, 16)
    .map((title, index) => {
      const exposure = history[title.id],
        age = exposure
          ? Math.max(0, now - exposure.lastAt) / 86400000
          : Infinity;
      const fatigue = exposure
        ? Math.log1p(exposure.count) * 2 * Math.exp(-age / 7) +
          (age < 0.5 ? 1.2 : 0)
        : 0;
      return { title, score: index / 12 + fatigue };
    })
    .sort((a, b) => a.score - b.score)[0]?.title;
}

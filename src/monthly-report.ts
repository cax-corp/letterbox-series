import type { Library } from "./store";
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
export function monthlyReport(
  library: Library,
  month: string,
  now = new Date(),
) {
  const today = `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
  const validDate = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s > today) return false;
    const [y, m, d] = s.split("-").map(Number),
      date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  };
  const watched = Object.values(library).filter(
      (e) => e.watched && validDate(e.watchedAt),
    ),
    entries = watched.filter((e) => e.watchedAt.startsWith(month + "-")),
    rated = entries.filter((e) => e.rating > 0),
    genres = new Map<string, number>();
  for (const e of entries)
    for (const genre of new Set(e.title.genres))
      genres.set(genre, (genres.get(genre) || 0) + 1);
  const previous = watched.filter((e) =>
    e.watchedAt.startsWith(shiftMonth(month, -1) + "-"),
  );
  return {
    entries,
    movies: entries.filter((e) => e.title.kind === "movie").length,
    series: entries.filter((e) => e.title.kind === "series").length,
    favorites: entries.filter((e) => e.favorite).length,
    activeDays: new Set(entries.map((e) => e.watchedAt)).size,
    average: rated.length
      ? rated.reduce((n, e) => n + e.rating, 0) / rated.length
      : null,
    previousCount: previous.length,
    genres: [...genres]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5),
    highlights: [...rated]
      .sort(
        (a, b) => b.rating - a.rating || b.watchedAt.localeCompare(a.watchedAt),
      )
      .slice(0, 4),
  };
}

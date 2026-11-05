import type { Library } from "./store";
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dateOf(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number),
    date = new Date(y, m - 1, d);
  return dayKey(date) === value ? date : null;
}
export function profileStats(library: Library, now = new Date()) {
  const entries = Object.values(library),
    watched = entries.filter((e) => e.watched),
    rated = entries.filter((e) => e.rating > 0),
    today = dayKey(now),
    days = new Set<string>(),
    genres = new Map<string, number>();
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: dayKey(date).slice(0, 7),
      label: date.toLocaleDateString("fr-FR", { month: "short" }),
      count: 0,
    };
  });
  let thisMonth = 0;
  for (const entry of watched) {
    const d = dateOf(entry.watchedAt);
    if (d && entry.watchedAt <= today) {
      days.add(entry.watchedAt);
      const key = entry.watchedAt.slice(0, 7),
        month = months.find((m) => m.key === key);
      if (month) month.count++;
      if (key === today.slice(0, 7)) thisMonth++;
    }
    for (const g of new Set(entry.title.genres))
      genres.set(g, (genres.get(g) || 0) + 1);
  }
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    watched: watched.length,
    movies: watched.filter((e) => e.title.kind === "movie").length,
    series: watched.filter((e) => e.title.kind === "series").length,
    watchlist: entries.filter((e) => e.watchlist).length,
    favorites: entries.filter((e) => e.favorite).length,
    reviews: entries.filter((e) => e.review.trim()).length,
    average: rated.length
      ? Number(
          (rated.reduce((sum, e) => sum + e.rating, 0) / rated.length).toFixed(
            1,
          ),
        )
      : null,
    thisMonth,
    activeDays: days.size,
    streak,
    months,
    genres: [...genres]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3),
  };
}

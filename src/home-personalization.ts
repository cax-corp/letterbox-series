import type { Title } from "./catalog";
import type { Entry } from "./store";
import {
  buildTasteProfile,
  movieGenres,
  sameMovie,
  tasteWeight,
} from "./recommendations";

/** Homepage/notification preparation: small linear scoring, without training or running the feed model. */
export function rankHomeTitles(
  library: Record<string, Entry>,
  titles: Title[],
) {
  const profile = buildTasteProfile(library);
  const scale = Math.max(1, ...[...profile.genres.values()].map(Math.abs));
  const positive = profile.entries.filter((entry) => tasteWeight(entry) > 1);
  const seen = profile.entries.filter(
    (entry) =>
      entry.watched ||
      entry.rating > 0 ||
      entry.favorite ||
      entry.recommendationFeedback,
  );
  const unique = [
    ...new Map(titles.map((title) => [title.id, title])).values(),
  ];
  return unique
    .map((title, index) => {
      const genres = movieGenres(title);
      const affinity =
        genres.reduce(
          (sum, id) => sum + (profile.genres.get(id) || 0) / scale,
          0,
        ) / Math.max(1, genres.length);
      const year = Number(title.year);
      const era = year
        ? Math.max(
            0,
            ...positive.map((entry) =>
              Number(entry.title.year)
                ? Math.exp(-Math.abs(year - Number(entry.title.year)) / 20)
                : 0,
            ),
          ) * 0.25
        : 0;
      const known = seen.some(
        (entry) => entry.title.id === title.id || sameMovie(entry.title, title),
      );
      const watchlist = library[title.id]?.watchlist ? 0.3 : 0;
      return {
        title,
        index,
        score:
          affinity * 2 +
          era +
          (title.score ?? 6.5) / 30 +
          watchlist -
          (known ? 5 : 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.title);
}
export function personalizeHome(
  library: Record<string, Entry>,
  films: Title[],
  shows: Title[],
) {
  const movies = rankHomeTitles(library, films),
    series = rankHomeTitles(library, shows);
  const hero = rankHomeTitles(library, [
    ...movies.slice(0, 6),
    ...series.slice(0, 6),
  ])[0];
  return {
    movies,
    series,
    hero,
    personalized: Object.values(library).some(
      (entry) => Math.abs(tasteWeight(entry)) > 1,
    ),
  };
}

import { test, expect } from "./fixtures";
import { personalizeHome, rankHomeTitles } from "../src/home-personalization";
import type { Title } from "../src/catalog";
import type { Entry } from "../src/store";
const title = (
  id: number,
  name: string,
  genre: string,
  kind: Title["kind"] = "movie",
): Title => ({
  id: `${kind}-${id}`,
  kind,
  name,
  year: "2024",
  image: "",
  summary: "Une histoire.",
  genres: [genre],
  score: 8,
});
const entry = (t: Title, patch: Partial<Entry> = {}): Entry => ({
  title: t,
  watched: true,
  watchlist: false,
  favorite: true,
  rating: 5,
  review: "",
  updated: "2026-11-05T12:00:00Z",
  watchedAt: "2026-11-05",
  episodes: [],
  ...patch,
});
test("l’accueil classe films et séries par goûts et adapte son film mis en avant", () => {
  const space = title(1, "Station orbitale", "Science-fiction"),
    treasure = title(2, "La bande du trésor", "Aventure"),
    tv = title(3, "Un voyage familial", "Aventure", "series");
  const sf = entry(title(100, "Un favori spatial", "Science-fiction"));
  const a = personalizeHome({ sf }, [treasure, space], [tv]);
  expect(a.movies[0].id).toBe(space.id);
  expect(a.hero.id).toBe(space.id);
  expect(a.personalized).toBe(true);
  const adventure = entry(title(200, "Les Goonies", "Aventure"));
  const rejected = entry(sf.title, {
    favorite: false,
    rating: 1,
    recommendationFeedback: "dislike",
  });
  const b = personalizeHome({ adventure, rejected }, [space, treasure], [tv]);
  expect(b.movies[0].id).toBe(treasure.id);
  expect(b.hero.id).not.toBe(space.id);
});
test("une série aimée influence l’accueil et les titres déjà connus passent après les découvertes", () => {
  const tv = title(200, "Ma série SF", "Sci-Fi & Fantasy", "series"),
    known = title(1, "Déjà vu", "Science-fiction"),
    fresh = title(2, "Autre mission", "Science-fiction"),
    crime = title(3, "Un polar", "Crime");
  const list = rankHomeTitles({ tv: entry(tv), known: entry(known) }, [
    known,
    crime,
    fresh,
  ]);
  expect(list[0].id).toBe(fresh.id);
  expect(list.at(-1)?.id).toBe(known.id);
});

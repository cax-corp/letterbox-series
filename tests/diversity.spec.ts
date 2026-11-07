import { test, expect } from "./fixtures";
import { buildTasteProfile, rankRecommendations } from "../src/recommendations";
import { tasteFamily, franchiseKey } from "../src/taste-features";
import { empty, type Library } from "../src/store";
import type { Title } from "../src/catalog";
import { rememberHomeExposure, chooseHomeHero } from "../src/home-history";
import { personalizeHome } from "../src/home-personalization";
const title = (
  id: number,
  name: string,
  genreIds: number[],
  summary: string,
): Title => ({
  id: `tmdb-movie-${id}`,
  source: "tmdb",
  kind: "movie",
  name,
  genreIds,
  summary,
  genres: [],
  year: "2022",
  image: "",
  score: 8,
  voteCount: 1000,
});
const hero = (id: number) =>
  title(
    id,
    `Spider-Man ${id}`,
    [28, 12, 878],
    "Un super-héros combat des ennemis avec ses super-pouvoirs.",
  );
const space = (id: number) =>
  title(
    id,
    `Station ${id}`,
    [878, 12],
    "Des astronautes explorent une planète pour sauver une mission spatiale.",
  );
const comedy = (id: number) =>
  title(
    id,
    `Week-end ${id}`,
    [35, 18],
    "Une famille et des amis partent pour un voyage amusant.",
  );
const anime = (id: number) =>
  title(
    id,
    `Voyage anime ${id}`,
    [16, 14],
    "Un animé suit un enfant et ses amis dans une aventure magique.",
  );
test("vingt favoris super-héros ne monopolisent ni les références initiales ni les huit premières cartes", () => {
  const library: Library = {};
  for (let i = 1; i <= 20; i++) {
    const t = hero(i);
    library[t.id] = {
      ...empty(t),
      favorite: true,
      recommendationFeedback: "like",
      updated: new Date().toISOString(),
    };
  }
  for (const t of [space(101), comedy(102), anime(103)])
    library[t.id] = { ...empty(t), favorite: true, rating: 5 };
  const before = JSON.stringify(library),
    profile = buildTasteProfile(library);
  expect(
    new Set(
      profile.seeds
        .slice(0, 4)
        .map((e) => tasteFamily(e.title, e.title.genreIds)),
    ).size,
  ).toBeGreaterThanOrEqual(3);
  const candidates = [
    ...Array.from({ length: 20 }, (_, i) => hero(200 + i)),
    ...Array.from({ length: 6 }, (_, i) => space(300 + i)),
    ...Array.from({ length: 6 }, (_, i) => comedy(400 + i)),
    ...Array.from({ length: 6 }, (_, i) => anime(500 + i)),
  ].map((t) => ({
    title: t,
    seeds: profile.seeds
      .filter(
        (e) =>
          tasteFamily(e.title, e.title.genreIds) === tasteFamily(t, t.genreIds),
      )
      .map((e, rank) => ({ id: e.title.id, name: e.title.name, rank })),
  }));
  const ranked = rankRecommendations(profile, candidates, [], 8);
  expect(ranked).toHaveLength(8);
  expect(
    ranked.filter(
      (item) => tasteFamily(item.title, item.title.genreIds) === "superheroes",
    ).length,
  ).toBeLessThanOrEqual(2);
  expect(
    new Set(ranked.map((item) => tasteFamily(item.title, item.title.genreIds)))
      .size,
  ).toBeGreaterThanOrEqual(3);
  expect(
    ranked.filter((item) => franchiseKey(item.title) === "spiderman").length,
  ).toBeLessThanOrEqual(1);
  expect(JSON.stringify(library)).toBe(before);
});
test("À voir reste une envie faible, pas un coup de cœur ni une référence de voisinage", () => {
  const t = hero(1),
    profile = buildTasteProfile({ [t.id]: { ...empty(t), watchlist: true } });
  expect(profile.seeds).toHaveLength(0);
  expect(profile.positiveCount).toBe(0);
  expect(profile.weights.get(t.id)).toBeLessThan(1);
  expect(rankRecommendations(profile, [{ title: t, seeds: [] }])).toHaveLength(
    0,
  );
});
test("Découvrir : les expositions ignorées renouvellent le premier titre sans inventer de refus", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    ),
    map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => map.set(key, value),
    },
  });
  try {
    const titles = [space(1), space(2), space(3)],
      library: Library = {};
    const before = JSON.stringify(library),
      now = Date.now();
    const first = chooseHomeHero(titles, "a", now)!;
    rememberHomeExposure(first, "a", now);
    const next = chooseHomeHero(titles, "a", now + 1000)!;
    expect(next.id).not.toBe(first.id);
    expect(chooseHomeHero(titles, "b", now + 1000)?.id).toBe(first.id);
    const p = personalizeHome(library, titles, [], "a");
    expect(p.hero.id).not.toBe(first.id);
    expect(JSON.stringify(library)).toBe(before);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as any).localStorage;
  }
});

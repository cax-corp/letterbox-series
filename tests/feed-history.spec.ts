import { test, expect } from "@playwright/test";
import {
  freshSuggestions,
  localDay,
  rememberSuggestion,
  wasSuggestedToday,
  readFeedHistory,
} from "../src/feed-history";
import type { Suggestion } from "../src/recommendations";
const ranked: Suggestion[] = [1, 2, 3].map((id) => ({
  title: {
    id: `movie-${id}`,
    kind: "movie",
    name: `Film ${id}`,
    image: "",
    year: "2024",
    genres: [],
    summary: "",
  },
  score: 10 - id,
  reason: "Vos goûts",
}));
let original: PropertyDescriptor | undefined;
test.beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
});
test.afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as any).localStorage;
});
test("aucun recyclage : les cartes affichées sont exclues, sans déplacer le classement des autres", () => {
  expect(freshSuggestions(ranked, ["movie-1"]).map((x) => x.title.id)).toEqual([
    "movie-2",
    "movie-3",
  ]);
  expect(ranked.map((x) => x.title.id)).toEqual([
    "movie-1",
    "movie-2",
    "movie-3",
  ]);
});
test("un catalogue entièrement affiché ne renvoie aucune carte", () =>
  expect(
    freshSuggestions(
      ranked,
      ranked.map((x) => x.title.id),
    ),
  ).toEqual([]));
test("exclusion de la journée locale, réouverture possible après minuit et comptes séparés", () => {
  const date = new Date(2026, 10, 5, 23, 59),
    tomorrow = new Date(2026, 10, 6, 0, 1),
    t = ranked[0].title;
  expect(localDay(date)).toBe("2026-11-05");
  rememberSuggestion(t, "midnight", date);
  expect(wasSuggestedToday(t, "midnight", date)).toBe(true);
  expect(wasSuggestedToday(t, "midnight", tomorrow)).toBe(false);
  expect(wasSuggestedToday(t, "someone-else", date)).toBe(false);
});
test("le registre quotidien ne recycle pas après les 300 premières cartes", () => {
  const date = new Date(2026, 10, 5, 12);
  for (let i = 0; i < 420; i++)
    rememberSuggestion(`movie-${i}`, "large-day", date);
  expect(readFeedHistory("large-day", date)).toHaveLength(420);
  expect(
    wasSuggestedToday({ ...ranked[0].title, id: "movie-0" }, "large-day", date),
  ).toBe(true);
});
test("identité par titre et année entre fournisseurs, sans exclure les remakes", () => {
  const t = { ...ranked[0].title, name: "Éclats", year: "2014" },
    date = new Date(2026, 10, 5);
  rememberSuggestion(t, "identity", date);
  expect(
    wasSuggestedToday(
      { ...t, id: "tmdb-movie-999", name: "Eclats" },
      "identity",
      date,
    ),
  ).toBe(true);
  expect(
    wasSuggestedToday(
      { ...t, id: "tmdb-movie-998", name: "Eclats", year: "2025" },
      "identity",
      date,
    ),
  ).toBe(false);
});

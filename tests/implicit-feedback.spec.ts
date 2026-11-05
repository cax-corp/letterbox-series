import { test, expect } from "@playwright/test";
import {
  QuickSkipTracker,
  rememberQuickSkip,
  readSkipSignals,
} from "../src/implicit-feedback";
import { buildTasteProfile, rankRecommendations } from "../src/recommendations";
import { empty, type Entry } from "../src/store";
import type { Title } from "../src/catalog";
const DAY = 86400000;
const title = (id: number, genre = "Horreur"): Title => ({
  id: `tmdb-movie-${id}`,
  kind: "movie",
  name: `Film ${id}`,
  year: "2024",
  image: "",
  summary:
    genre === "Horreur"
      ? "Un tueur hante une maison : une nuit de terreur et de cauchemar."
      : "Des amis cherchent un trésor dans une aventure et une expédition.",
  genres: [genre],
  source: "tmdb",
});
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const values = new Map<string, string>();
test.beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
});
test.afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  else delete (globalThis as any).localStorage;
});
test("passage rapide vers l’avant : mesure de la carte arrêtée, sans compter l’animation", () => {
  const t = new QuickSkipTracker(),
    a = title(1),
    b = title(2);
  t.update(a, 0, false, false, 0);
  t.intent(true);
  t.update(a, 0, true, false, 600);
  t.update(b, 1, true, false, 3600);
  expect(t.update(b, 1, false, false, 4000)).toEqual({ title: a, dwell: 600 });
  expect(t.update(b, 1, false, false, 4100)).toBe(null);
});
test("défilement annulé, retour arrière, déplacement programmatique et aperçu trop bref ne sont pas des rejets", () => {
  const a = title(1),
    b = title(2);
  const programmatic = new QuickSkipTracker();
  programmatic.update(a, 0, false, false, 0);
  expect(programmatic.update(b, 1, false, false, 800)).toBe(null);
  const backward = new QuickSkipTracker();
  backward.update(b, 1, false, false, 0);
  backward.intent(false);
  expect(backward.update(a, 0, false, false, 800)).toBe(null);
  const brief = new QuickSkipTracker();
  brief.update(a, 0, false, false, 0);
  brief.intent(true);
  expect(brief.update(b, 1, false, false, 100)).toBe(null);
  const cancelled = new QuickSkipTracker();
  cancelled.update(a, 0, false, false, 0);
  cancelled.intent(true);
  cancelled.update(a, 0, true, false, 500);
  cancelled.update(a, 0, false, false, 700);
  expect(cancelled.update(b, 1, false, false, 900)).toBe(null);
});
test("lecture longue, détails, pause et arrière-plan ne fabriquent pas un rejet au retour", () => {
  const a = title(1),
    b = title(2),
    long = new QuickSkipTracker();
  long.update(a, 0, false, false, 0);
  long.intent(true);
  expect(long.update(b, 1, false, false, 4500)).toBe(null);
  const detail = new QuickSkipTracker();
  detail.update(a, 0, false, false, 0);
  detail.engage(a.id);
  detail.intent(true);
  expect(detail.update(b, 1, false, false, 800)).toBe(null);
  const paused = new QuickSkipTracker();
  paused.update(a, 0, false, false, 0);
  paused.update(a, 0, false, true, 500);
  paused.update(a, 0, false, false, 600);
  paused.intent(true);
  expect(paused.update(b, 1, false, false, 1300)).toBe(null);
  const hidden = new QuickSkipTracker();
  hidden.update(a, 0, false, false, 0);
  hidden.suspend();
  hidden.update(a, 0, false, false, 10000);
  hidden.intent(true);
  expect(hidden.update(b, 1, false, false, 10800)).toBe(null);
});
test("signaux locaux bornés, isolés par compte, sans doublon quotidien et atténués dans le temps", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  expect(rememberQuickSkip(title(1), 700, "a", now)).toBe(true);
  expect(rememberQuickSkip(title(1), 700, "a", now + 1000)).toBe(false);
  const fresh = readSkipSignals("a", now)[0].strength;
  expect(readSkipSignals("a", now + 7 * DAY)[0].strength).toBeCloseTo(
    fresh / 2,
  );
  expect(readSkipSignals("a", now + 31 * DAY)).toEqual([]);
  expect(readSkipSignals("b", now)).toEqual([]);
  for (let i = 2; i < 160; i++) rememberQuickSkip(title(i), 800, "a", now + i);
  expect(readSkipSignals("a", now + 200)).toHaveLength(120);
  expect(values.has("luma-library-v1")).toBe(false);
});
test("plusieurs skips similaires réduisent progressivement le score, beaucoup moins qu’un refus explicite", () => {
  const horror = title(800),
    adventure = title(801, "Aventure"),
    pool = [horror, adventure].map((title) => ({ title, seeds: [] }));
  const score = (profile: ReturnType<typeof buildTasteProfile>, id: string) =>
    rankRecommendations(profile, pool).find((s) => s.title.id === id)!.score;
  const base = buildTasteProfile({}),
    one = buildTasteProfile({}, [{ title: title(1), strength: 0.13 }]);
  const many = buildTasteProfile(
    {},
    Array.from({ length: 20 }, (_, i) => ({
      title: title(i + 1),
      strength: 0.13,
    })),
  );
  const rejected: Entry = {
    ...empty(title(100)),
    recommendationFeedback: "dislike",
  };
  const explicit = buildTasteProfile({ [rejected.title.id]: rejected });
  expect(score(one, horror.id)).toBeLessThan(score(base, horror.id));
  expect(score(many, horror.id)).toBeLessThan(score(one, horror.id));
  expect(score(base, horror.id) - score(many, horror.id)).toBeLessThanOrEqual(
    0.700001,
  );
  expect(score(explicit, horror.id)).toBeLessThan(score(many, horror.id) - 1);
  expect(score(many, adventure.id)).toBeCloseTo(score(base, adventure.id), 4);
  expect(many.negativeCount).toBe(0);
  expect(many.entries).toHaveLength(0);
  expect(many.fetchKey).toBe(base.fetchKey);
  expect(many.rankKey).not.toBe(base.rankKey);
});
test("un choix explicite annule l’effet du skip de ce film, y compris un autre fournisseur", () => {
  const skipped = title(1),
    local = { ...skipped, id: "movie-1", source: "itunes" as const };
  for (const patch of [
    { favorite: true },
    { watchlist: true },
    { watched: true },
    { rating: 4 },
    { recommendationFeedback: "like" as const },
    { recommendationFeedback: "dislike" as const },
  ]) {
    const e = { ...empty(local), ...patch };
    expect(
      buildTasteProfile({ [e.title.id]: e }, [
        { title: skipped, strength: 0.13 },
      ]).implicit,
    ).toEqual([]);
  }
});

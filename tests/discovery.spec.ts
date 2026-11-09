import { test, expect } from "./fixtures";
import {
  validateDiscovery,
  defaultDiscovery,
  isExcluded,
} from "../src/discovery-preferences";
import { monthlyReport, shiftMonth } from "../src/monthly-report";
import { empty, type Library } from "../src/store";
import { reviewDraft, validateSharedPage } from "../src/public-sharing";
import { defaultProfile } from "../src/profile";
const title = (id: number, genres = ["Action"]) => ({
  id: `tmdb-movie-${id}`,
  kind: "movie" as const,
  name: `Titre ${id}`,
  year: "2024",
  genres,
  genreIds: genres.includes("Action") ? [28] : [18],
  image: "",
  summary: "Synopsis",
});
test("exclusions : genres et saga réels, aucun retrait des notes ou de la collection", () => {
  const prefs = {
    ...defaultDiscovery,
    genres: [28],
    sagas: [{ id: 55, name: "Saga" }],
  };
  expect(validateDiscovery(prefs)).not.toBeNull();
  expect(isExcluded(title(1), prefs)).toBe(true);
  expect(isExcluded({ ...title(2, ["Drame"]), collectionId: 55 }, prefs)).toBe(
    true,
  );
  expect(isExcluded(title(3, ["Drame"]), prefs, new Set([3]))).toBe(true);
  expect(isExcluded(title(4, ["Drame"]), prefs, new Set([3]))).toBe(false);
  expect(validateDiscovery({ ...prefs, genres: [999999] })).toBeNull();
  expect(
    validateDiscovery({ ...prefs, sagas: [{ id: -1, name: "invalid" }] }),
  ).toBeNull();
  expect(validateDiscovery({ ...prefs, protectSpoilers: "false" })).toBeNull();
});
test("bilan mensuel : mois précis, moyenne des titres vus, dates invalides/futures ignorées et changement d’année", () => {
  const library: Library = {};
  for (let i = 1; i <= 6; i++) {
    const t = title(i);
    library[t.id] = {
      ...empty(t),
      watched: i !== 6,
      rating: i === 1 ? 5 : i === 2 ? 3 : i === 6 ? 1 : 0,
      watchedAt:
        i === 3
          ? "2026-10-15"
          : i === 4
            ? "2026-11-31"
            : i === 5
              ? "2026-12-01"
              : "2026-11-03",
      favorite: i === 1,
    };
  }
  const report = monthlyReport(library, "2026-11", new Date(2026, 10, 9));
  expect(report.entries).toHaveLength(2);
  expect(report.average).toBe(4);
  expect(report.activeDays).toBe(1);
  expect(report.previousCount).toBe(1);
  expect(report.favorites).toBe(1);
  expect(report.highlights[0].rating).toBe(5);
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
});
test("partage : indicateur spoiler explicite conservé, ancien avis compatible et type invalide refusé", () => {
  const entry = {
    ...empty(title(1)),
    review: "Le coupable est…",
    spoiler: true,
    rating: 4,
  };
  const draft = reviewDraft({ ...defaultProfile, displayName: "Nora" }, entry);
  expect(draft.payload?.review?.spoiler).toBe(true);
  const shared = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "review",
    payload: draft.payload,
    updated_at: new Date().toISOString(),
  };
  expect(validateSharedPage(shared)?.payload.review?.spoiler).toBe(true);
  expect(
    validateSharedPage({
      ...shared,
      payload: {
        ...draft.payload,
        review: { ...draft.payload!.review, spoiler: "yes" },
      },
    }),
  ).toBeNull();
});

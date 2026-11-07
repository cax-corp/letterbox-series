import { test, expect } from "./fixtures";
import {
  setDailyRecommendations,
  defaultDaily,
  buildDailyPayload,
  refreshDailyContext,
  type DailyAdapter,
  type DailyPayload,
} from "../src/notifications";
const initial = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
test.beforeAll(() =>
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "" },
  }),
);
test.afterAll(() => {
  if (initial) Object.defineProperty(globalThis, "localStorage", initial);
  else delete (globalThis as any).localStorage;
});
function adapter(granted = true) {
  const saved: DailyPayload[] = [];
  let prompts = 0;
  const api: DailyAdapter = {
    getState: async () => ({
      config: { ...defaultDaily, enabled: true },
      granted,
      nextAt: 0,
    }),
    requestNotificationPermission: async () => {
      prompts++;
      return { granted };
    },
    configure: async ({ config }) => {
      saved.push(config);
      return { config, granted, nextAt: 123 };
    },
    updateContext: async ({ context }) => {
      saved.push(context);
      return { config: defaultDaily, granted, nextAt: 0 };
    },
    openSettings: async () => {},
    addListener: async () => ({ remove: async () => {} }),
  };
  return { api, saved, prompts: () => prompts };
}
test("notification refusée : aucune programmation ; activation autorisée : horaire et jours transmis", async () => {
  const no = adapter(false);
  await expect(
    setDailyRecommendations({ ...defaultDaily, enabled: true }, {}, [], no.api),
  ).rejects.toThrow("bloquées");
  expect(no.saved).toHaveLength(0);
  const yes = adapter();
  await setDailyRecommendations(
    {
      ...defaultDaily,
      enabled: true,
      hour: 19,
      minute: 45,
      days: [1, 3, 5],
      reliableAlarm: true,
    },
    {},
    [],
    yes.api,
  );
  expect(yes.prompts()).toBe(1);
  expect(yes.saved[0]).toMatchObject({
    enabled: true,
    hour: 19,
    minute: 45,
    days: [1, 3, 5],
    reliableAlarm: true,
  });
});
test("désactivation sans demande de permission et refus des jours vides", async () => {
  const a = adapter(false);
  await setDailyRecommendations(defaultDaily, {}, [], a.api);
  expect(a.prompts()).toBe(0);
  expect(a.saved[0].enabled).toBe(false);
  await expect(
    setDailyRecommendations(
      { ...defaultDaily, enabled: true, days: [] },
      {},
      [],
      a.api,
    ),
  ).rejects.toThrow("au moins un jour");
});
test("mise à jour des goûts sans nouveau dialogue et sans texte de critique dans la tâche native", async () => {
  const a = adapter();
  const title = {
    id: "tmdb-movie-8",
    source: "tmdb" as const,
    kind: "movie" as const,
    name: "Un film privé",
    year: "2025",
    summary: "Synopsis public",
    image: "",
    genres: ["Science-fiction"],
  };
  const entry = {
    title,
    watched: true,
    watchlist: false,
    rating: 5,
    favorite: true,
    review: "MA CRITIQUE PRIVÉE",
    updated: "2026-11-05T00:00:00Z",
    watchedAt: "2026-11-05",
    episodes: [],
  };
  const library = { [title.id]: entry };
  await refreshDailyContext(library, [], a.api);
  expect(a.prompts()).toBe(0);
  expect(a.saved[0].preparedAt).toBeGreaterThan(0);
  expect(a.saved[0]).not.toHaveProperty("token");
  expect(a.saved[0]).not.toHaveProperty("weights");
  expect(a.saved[0]).not.toHaveProperty("seedIds");
  expect(a.saved[0].excluded[0].id).toBe(title.id);
  expect(JSON.stringify(a.saved[0])).not.toContain("MA CRITIQUE PRIVÉE");
  expect(buildDailyPayload(defaultDaily, library, []).candidates).toEqual([]);
});

test("la réserve est bornée et ne contient aucune donnée nécessaire au moteur ou au réseau en arrière-plan", () => {
  const titles = Array.from({ length: 50 }, (_, i) => ({
    id: `tmdb-movie-${i + 1}`,
    kind: "movie" as const,
    name: `Film ${i + 1}`,
    year: "2024",
    image: "",
    summary: "Synopsis public",
    genres: ["Aventure"],
  }));
  const payload = buildDailyPayload(defaultDaily, {}, titles);
  expect(payload.candidates).toHaveLength(30);
  expect(payload).not.toHaveProperty("token");
  expect(payload).not.toHaveProperty("weights");
  expect(payload).not.toHaveProperty("seedIds");
  expect(payload.candidates.every((c) => c.title.kind === "movie")).toBe(true);
});

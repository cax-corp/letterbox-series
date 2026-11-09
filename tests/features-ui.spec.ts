import { test, expect, type Page } from "./fixtures";
import { empty } from "../src/store";
import { defaultProfile } from "../src/profile";
import { reviewDraft } from "../src/public-sharing";
const project = "https://ilrigdnewnsneuwbggqg.supabase.co",
  id = "77777777-7777-4777-8777-777777777777",
  shareId = "88888888-8888-4888-8888-888888888888";
const movies = [
  { id: 101, title: "Aventure Alpha", genre_ids: [28] },
  { id: 201, title: "Drame Saga", genre_ids: [18] },
  { id: 102, title: "Drame Libre", genre_ids: [18] },
].map((m) => ({
  ...m,
  release_date: "2024-01-01",
  overview: "Une histoire de cinéma.",
  poster_path: null,
  vote_average: 8,
  vote_count: 2000,
}));
const titles = movies.map((m) => ({
  id: "tmdb-movie-" + m.id,
  kind: "movie" as const,
  source: "tmdb" as const,
  name: m.title,
  year: "2024",
  genres: m.genre_ids[0] === 28 ? ["Action"] : ["Drame"],
  genreIds: m.genre_ids,
  image: "",
  summary: m.overview,
}));
const seeded = Object.fromEntries(
  titles.map((t, i) => [
    t.id,
    {
      ...empty(t),
      watched: true,
      watchedAt: "2026-11-03",
      rating: i === 0 ? 5 : 4,
      review: i === 0 ? "Le secret final est ici." : "",
      spoiler: i === 0,
      favorite: i === 0,
    },
  ]),
);
async function setup(page: Page, native = false) {
  const expiry = Date.parse("2028-01-01") / 1000,
    jwt = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: id, role: "authenticated", exp: expiry }),
      ).toString("base64url"),
      "test",
    ].join(".");
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "nora@example.com",
    created_at: "2026-11-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {
      vela_profile: { ...defaultProfile, displayName: "Nora" },
    } as any,
  };
  const writes: any[] = [];
  await page.addInitScript(
    ({ user, jwt, expiry, seeded, native }) => {
      if (!localStorage.getItem("sb-ilrigdnewnsneuwbggqg-auth-token"))
        localStorage.setItem(
          "sb-ilrigdnewnsneuwbggqg-auth-token",
          JSON.stringify({
            access_token: jwt,
            refresh_token: "fake",
            token_type: "bearer",
            expires_at: expiry,
            expires_in: 31536000,
            user,
          }),
        );
      if (!localStorage.getItem("luma-library-v1-" + user.id))
        localStorage.setItem(
          "luma-library-v1-" + user.id,
          JSON.stringify(seeded),
        );
      if (native) {
        const w = window as any;
        w.CapacitorCustomPlatform = { name: "android" };
        w.updateCalls = [];
        w.updateState = {
          available: false,
          version: "2.10.0",
          url: "",
          enabled: true,
          granted: true,
          lastCheck: 0,
        };
        w.Capacitor = {
          PluginHeaders: [
            {
              name: "AppUpdates",
              methods: [
                "getState",
                "check",
                "configure",
                "requestPermission",
                "openDownload",
              ].map((name) => ({ name, rtype: "promise" })),
            },
            {
              name: "DailyRecommendations",
              methods: ["getState", "configure", "updateContext"].map(
                (name) => ({ name, rtype: "promise" }),
              ),
            },
            {
              name: "LumaAppearance",
              methods: [{ name: "setTheme", rtype: "promise" }],
            },
            {
              name: "SystemBars",
              methods: [{ name: "setStyle", rtype: "promise" }],
            },
          ],
          nativePromise: async (plugin: string, method: string, args: any) => {
            if (plugin === "AppUpdates") {
              w.updateCalls.push({ method, args });
              if (method === "configure") w.updateState.enabled = args.enabled;
              if (method === "check" && args.force)
                w.updateState = {
                  ...w.updateState,
                  available: true,
                  version: "2.11.0",
                  url: "https://vela.thomasbarial.com/downloads/Vela-2.11.0.apk",
                  lastCheck: Date.now(),
                };
              return { ...w.updateState };
            }
            if (plugin === "DailyRecommendations")
              return {
                config: {
                  enabled: false,
                  hour: 19,
                  minute: 0,
                  days: [0, 1, 2, 3, 4, 5, 6],
                },
                granted: true,
                nextAt: 0,
              };
            return {};
          },
        };
      }
    },
    { user, jwt, expiry, seeded, native },
  );
  await page.route(project + "/auth/v1/**", (route) => {
    if (route.request().method() === "PUT") {
      const data = route.request().postDataJSON().data;
      writes.push(data);
      Object.assign(user.user_metadata, data);
    }
    return route.fulfill({ json: user });
  });
  await page.route(project + "/rest/v1/library*", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? Object.values(seeded).map((entry) => ({ entry }))
          : [],
    }),
  );
  await page.route(project + "/rest/v1/vela_shares*", (route) =>
    route.fulfill({
      json: {
        id: shareId,
        kind: "review",
        payload: reviewDraft(
          { ...defaultProfile, displayName: "Nora" },
          seeded[titles[0].id],
        ).payload,
        updated_at: "2026-11-09T12:00:00Z",
      },
    }),
  );
  await page.route("https://api.themoviedb.org/3/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    let result: any = {
      results: path.includes("/tv/") ? [] : movies,
      total_pages: 1,
    };
    if (path.endsWith("/collection/9"))
      result = { id: 9, name: "Saga Alpha", parts: [movies[0], movies[1]] };
    if (/\/movie\/\d+$/.test(path)) {
      const m = movies.find((m) => path.endsWith("/" + m.id)) || movies[0];
      result = {
        ...m,
        genres: m.genre_ids.map((id) => ({
          id,
          name: id === 28 ? "Action" : "Drame",
        })),
        belongs_to_collection:
          m.id === 101 || m.id === 201 ? { id: 9, name: "Saga Alpha" } : null,
      };
    }
    if (path.includes("/watch/providers")) result = { results: [] };
    return route.fulfill({ json: result });
  });
  await page.goto("/");
  await expect(page.locator(".account")).toContainText("Mon espace");
  return { writes, user };
}
test.use({ baseURL: "http://127.0.0.1:5174" });
async function settings(page: Page) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Réglages", exact: true })
    .click();
  return page.getByRole("region", { name: "Réglages", exact: true });
}
test("paramètres sans clés, exclusions de genre et saga synchronisées, recherche conservée", async ({
  page,
}) => {
  const state = await setup(page);
  const panel = await settings(page);
  await expect(panel.locator(".advanced-services")).toHaveCount(0);
  await expect(panel.locator('input[type="password"]')).toHaveCount(0);
  await panel.getByText("Genres exclus", { exact: false }).click();
  await panel.getByRole("checkbox", { name: "Action", exact: true }).check();
  await expect
    .poll(() => state.user.user_metadata.vela_discovery?.genres)
    .toEqual([28]);
  await panel.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(page.locator(".hero h2")).not.toContainText("Aventure Alpha");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Explorer", exact: true })
    .click();
  await page
    .getByLabel("Rechercher dans le catalogue", { exact: true })
    .fill("Alpha");
  await page
    .locator(".poster-card")
    .filter({ hasText: "Aventure Alpha" })
    .first()
    .click();
  const detail = page.getByRole("dialog");
  await detail
    .getByRole("button", {
      name: "Exclure cette saga des recommandations",
      exact: true,
    })
    .click();
  await expect
    .poll(() => state.user.user_metadata.vela_discovery?.sagas?.[0]?.id)
    .toBe(9);
  await detail.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Découvrir", exact: true })
    .click();
  await expect(page.locator(".hero h2")).toContainText("Drame Libre");
  const next = await settings(page);
  await next.getByRole("button", { name: "Réautoriser", exact: true }).click();
  await expect
    .poll(() => state.user.user_metadata.vela_discovery?.sagas?.length)
    .toBe(0);
  expect(JSON.stringify(state.writes)).not.toContain("parts");
});
test("spoilers : masqués dans le profil et le lien public, révélation volontaire et préférence du compte", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  const reviews = page.getByRole("region", { name: "Mes avis", exact: true });
  await expect(
    reviews.getByText("Le secret final est ici.", { exact: true }),
  ).toHaveCount(0);
  await reviews
    .getByRole("button", { name: "Afficher l’avis", exact: true })
    .click();
  await expect(
    reviews.getByText("Le secret final est ici.", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/s/" + shareId);
  await expect(
    page.getByRole("button", { name: "Afficher l’avis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Le secret final est ici.", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Afficher l’avis", exact: true })
    .click();
  await expect(
    page.getByText("Le secret final est ici.", { exact: true }),
  ).toBeVisible();
});
test("bilan mensuel et carte accessibles directement sur téléphone et PC", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page
    .getByRole("button", { name: "Ouvrir la carte de mes goûts", exact: true })
    .click();
  await expect(page).toHaveURL(/#tastes$/);
  await expect(
    page.getByRole("region", { name: "Carte de mes goûts", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page
    .getByRole("button", { name: "Bilan mensuel", exact: true })
    .click();
  const report = page.getByRole("region", {
    name: "Bilan mensuel",
    exact: true,
  });
  await expect(report).toBeVisible();
  await report.getByLabel("Mois du bilan", { exact: true }).fill("2026-11");
  await expect(report.locator(".monthly-highlights")).toContainText(
    "Aventure Alpha",
  );
  await report.screenshot({ path: info.outputPath("monthly-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await report.screenshot({ path: info.outputPath("monthly-PC.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("mise à jour Android : vérification manuelle, bannière et téléchargement à la demande", async ({
  page,
}) => {
  await setup(page, true);
  const panel = await settings(page);
  await panel
    .getByRole("button", { name: "Vérifier les mises à jour", exact: true })
    .click();
  await expect(page.locator(".update-banner")).toContainText("2.11.0");
  await page
    .locator(".update-banner")
    .getByRole("button", { name: "Télécharger", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as any).updateCalls.filter(
          (c: any) => c.method === "openDownload",
        ).length,
    ),
  ).toBe(1);
  await panel
    .getByRole("checkbox", {
      name: "M’avertir des nouvelles versions",
      exact: true,
    })
    .uncheck();
  expect(await page.evaluate(() => (window as any).updateState.enabled)).toBe(
    false,
  );
});

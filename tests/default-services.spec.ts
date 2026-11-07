import { test, expect, type Page } from "@playwright/test";
test.use({ baseURL: "http://127.0.0.1:5174" });
const project = "https://ilrigdnewnsneuwbggqg.supabase.co";
const id = "44444444-4444-4444-8444-444444444444";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "nora@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-11-05T00:00:00Z",
};
const expiry = Date.parse("2028-01-01T00:00:00Z") / 1000;
const jwt = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(
    JSON.stringify({ sub: id, role: "authenticated", exp: expiry }),
  ).toString("base64url"),
  "fake-signature",
].join(".");
async function setup(page: Page, url = project) {
  const keys: string[] = [],
    auth: string[] = [],
    writes: any[] = [];
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const u = new URL(r.request().url());
    keys.push(u.searchParams.get("api_key") || "");
    const tv = u.pathname.includes("/tv");
    return r.fulfill({
      json: {
        results: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          ...(tv
            ? { name: `Série Vela ${i + 1}`, first_air_date: "2024-01-01" }
            : { title: `Film Vela ${i + 1}`, release_date: "2024-01-01" }),
          overview: "Une aventure.",
          genre_ids: [12],
          vote_count: 100,
          vote_average: 8,
        })),
        total_pages: 3,
        total_results: 60,
      },
    });
  });
  await page.route(url + "/auth/v1/**", (r) => {
    auth.push(r.request().url());
    return r.fulfill({
      json: r.request().url().includes("/token")
        ? {
            access_token: jwt,
            refresh_token: "fake-refresh",
            expires_in: 31536000,
            expires_at: expiry,
            token_type: "bearer",
            user,
          }
        : user,
    });
  });
  await page.route(url + "/rest/v1/library*", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: [] });
    writes.push(r.request().postDataJSON());
    return r.fulfill({ status: 201, json: [] });
  });
  await page.route("**/itunes.apple.com/**", (r) => r.abort());
  await page.route("**/api.tvmaze.com/**", (r) => r.abort());
  return { keys, auth, writes };
}
async function login(page: Page) {
  const modal = page.getByRole("dialog", { name: "Connexion", exact: true });
  await modal.getByLabel("E-mail", { exact: true }).fill(user.email);
  await modal
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await modal
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
}
test("nouveau navigateur : catalogue TMDB prêt sans clé et Supabase prêt pour la connexion", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  await expect(page.locator(".poster-card").first()).toContainText("Film Vela");
  await expect(
    page.getByRole("button", { name: "Configurer TMDB", exact: true }),
  ).toHaveCount(0);
  expect(calls.keys.length).toBeGreaterThan(0);
  expect(
    calls.keys.every((k) => k === "982936a8c725ff021ed20d2641f6732c"),
  ).toBe(true);
  await expect(page.locator(".account")).toContainText("Se connecter");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Réglages", exact: true })
    .click();
  await expect(
    page.getByText(
      "Le catalogue et la synchronisation sont configurés. Aucune clé n’est à renseigner.",
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("URL du projet Supabase", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page.locator(".account").click();
  await login(page);
  expect(
    calls.auth.some((url) => url.startsWith(project + "/auth/v1/token")),
  ).toBe(true);
});
test("Android : pas de personnalisation avant connexion, feed actif après connexion et session restaurée", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("vela-welcome-v1", "done");
    w.CapacitorCustomPlatform = { name: "android" };
    w.Capacitor = {
      PluginHeaders: [
        {
          name: "SystemBars",
          methods: [{ name: "setStyle", rtype: "promise" }],
        },
        {
          name: "LumaAppearance",
          methods: [{ name: "setTheme", rtype: "promise" }],
        },
      ],
      nativePromise: async () => ({}),
    };
  });
  const workers: string[] = [];
  page.on("worker", (w) => workers.push(w.url()));
  await page.goto("/");
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Pour vous", exact: true })
    .click();
  await expect(
    page.getByText(
      "Connectez-vous pour accéder à vos recommandations personnalisées.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("feed")).toHaveCount(0);
  expect(workers).toEqual([]);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await login(page);
  await expect(page.getByRole("feed")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".recommendation-card").first()).toBeVisible();
  await page.reload();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Modifier mon profil", exact: true }),
  ).toBeVisible();
});
test("connexion : les données locales restent conservées et ne sont pas attribuées silencieusement au compte", async ({
  page,
}) => {
  const calls = await setup(page);
  const guest = {
    title: {
      id: "movie-999",
      kind: "movie",
      name: "Collection locale",
      year: "2024",
      image: "",
      summary: "",
      genres: [],
    },
    watched: true,
    watchlist: false,
    favorite: true,
    rating: 5,
    review: "Avis local",
    updated: "2026-11-05T12:00:00Z",
    watchedAt: "2026-11-05",
    episodes: [],
  };
  await page.addInitScript(
    (guest) =>
      localStorage.setItem(
        "luma-library-v1",
        JSON.stringify({ "movie-999": guest }),
      ),
    guest,
  );
  await page.goto("/");
  await expect(page.locator(".hero-kicker")).not.toHaveText("Selon vos goûts");
  await page.locator(".account").click();
  await login(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => !!localStorage.getItem("sb-ilrigdnewnsneuwbggqg-auth-token"),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("luma-library-v1")!)["movie-999"]
          .review,
    ),
  ).toBe("Avis local");
  expect(JSON.stringify(calls.writes)).not.toContain("movie-999");
  await page.locator(".account").click();
  await expect(
    page.getByRole("button", { name: "Modifier mon profil", exact: true }),
  ).toBeVisible();
});
test("une configuration personnalisée existante est conservée", async ({
  page,
}) => {
  const custom = "https://custom-vela.supabase.co",
    key = "a".repeat(32);
  await page.addInitScript(
    ({ url, key }) => {
      localStorage.setItem(
        "luma-cloud",
        JSON.stringify({ url, key: "sb_publishable_custom" }),
      );
      localStorage.setItem("luma-tmdb-token", key);
    },
    { url: custom, key },
  );
  const calls = await setup(page, custom);
  await page.goto("/");
  await expect(page.locator(".poster-card").first()).toBeVisible();
  expect(calls.keys.every((k) => k === key)).toBe(true);
  await page.locator(".account").click();
  await login(page);
  expect(
    calls.auth.some((url) => url.startsWith(custom + "/auth/v1/token")),
  ).toBe(true);
});

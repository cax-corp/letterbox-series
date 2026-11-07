import { test, expect, type Page } from "@playwright/test";
import { welcomeKey } from "../src/onboarding";
test.use({
  baseURL: "http://127.0.0.1:5174",
  viewport: { width: 390, height: 844 },
});
const project = "https://ilrigdnewnsneuwbggqg.supabase.co";
const user = {
  id: "66666666-6666-4666-8666-666666666666",
  aud: "authenticated",
  role: "authenticated",
  email: "nora@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-11-05T00:00:00Z",
};
const expiry = Date.parse("2028-01-01") / 1000;
const jwt = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(
    JSON.stringify({ sub: user.id, role: "authenticated", exp: expiry }),
  ).toString("base64url"),
  "fake-signature",
].join(".");
const session = {
  access_token: jwt,
  token_type: "bearer",
  refresh_token: "test-refresh",
  expires_in: 31536000,
  expires_at: expiry,
  user,
};
async function setup(page: Page, signed = false, native = true) {
  const calls = {
    catalogue: 0,
    signups: [] as any[],
    logins: 0,
    failLogin: false,
  };
  await page.addInitScript(
    ({ native, signed, session }) => {
      if (native) {
        const w = window as any;
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
      }
      if (signed && !localStorage.getItem("sb-ilrigdnewnsneuwbggqg-auth-token"))
        localStorage.setItem(
          "sb-ilrigdnewnsneuwbggqg-auth-token",
          JSON.stringify(session),
        );
    },
    { native, signed, session },
  );
  await page.route("https://api.themoviedb.org/3/**", (route) => {
    calls.catalogue++;
    const detail = {
      id: 42,
      title: "Film partagé",
      release_date: "2024-01-01",
      overview: "Une aventure.",
      genre_ids: [12],
      genres: [{ id: 12, name: "Aventure" }],
      credits: { cast: [] },
      vote_count: 100,
      vote_average: 8,
    };
    return route.fulfill({
      json: /\/movie\/42$/.test(new URL(route.request().url()).pathname)
        ? detail
        : { results: [], total_pages: 1, total_results: 0 },
    });
  });
  await page.route(project + "/auth/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/signup")) {
      calls.signups.push(route.request().postDataJSON());
      return route.fulfill({ json: { user, session: null } });
    }
    if (path.endsWith("/token")) {
      calls.logins++;
      return route.fulfill(
        calls.failLogin
          ? {
              status: 400,
              json: {
                error: "invalid_grant",
                error_description: "Identifiants incorrects",
              },
            }
          : { json: session },
      );
    }
    return route.fulfill({ json: user });
  });
  await page.route(project + "/rest/v1/**", (route) =>
    route.fulfill({ json: [] }),
  );
  return calls;
}
test("première ouverture Android : trois volets, navigation clavier/retour, couleurs et petit écran", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  const welcome = page.getByRole("main", {
    name: "Bienvenue dans Vela",
    exact: true,
  });
  await expect(welcome).toBeVisible();
  await expect(
    welcome.getByRole("heading", { name: "Bienvenue dans Vela.", exact: true }),
  ).toBeVisible();
  expect(calls.catalogue).toBe(0);
  await expect(page.locator(".mobile-nav,.sidebar")).toHaveCount(0);
  const tabs = welcome.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(welcome.getByRole("tabpanel")).toContainText(
    "Vos envies, vos notes, vos avis.",
  );
  await welcome
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(
    welcome.getByRole("heading", { name: "Connexion", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).lumaHandleBack())).toBe(
    true,
  );
  await expect(welcome.getByRole("tabpanel")).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await tabs.nth(0).click();
  await page.screenshot({
    path: "/workspace/artifacts/Vela-2.4.0-bienvenue-sombre.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    localStorage.setItem("luma-theme", "light");
    localStorage.setItem("vela-colour-theme-v1", "champagne");
  });
  await page.reload();
  await expect(welcome).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "champagne",
  );
  await page.screenshot({
    path: "/workspace/artifacts/Vela-2.4.0-bienvenue-clair.png",
    fullPage: true,
  });
});
test("explorer sans compte : catalogue puis redémarrage sans répéter la présentation", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explorer sans compte", exact: true })
    .click();
  await expect(page.locator(".welcome-page")).toHaveCount(0);
  await expect(page.locator(".mobile-nav")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBe("done");
  await expect.poll(() => calls.catalogue).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect(page.locator(".welcome-page")).toHaveCount(0);
});
test("inscription : formulaire complet, pays obligatoire et confirmation avant connexion", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  expect(calls.signups).toHaveLength(0);
  await page
    .getByLabel("Pays de résidence", { exact: true })
    .selectOption("FR");
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Vérifiez votre boîte mail.",
      exact: true,
    }),
  ).toBeVisible();
  expect(calls.signups).toHaveLength(1);
  expect(calls.signups[0]).toMatchObject({
    email: user.email,
    data: { vela_viewing: { country: "FR" } },
  });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBeNull();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
    user.email,
  );
  await page.screenshot({
    path: "/workspace/artifacts/Vela-2.4.0-connexion.png",
    fullPage: true,
  });
});
test("connexion : erreur récupérable puis compte connecté et accueil mémorisé", async ({
  page,
}) => {
  const calls = await setup(page);
  calls.failLogin = true;
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Identifiants incorrects",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBeNull();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
    user.email,
  );
  calls.failLogin = false;
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".welcome-page")).toHaveCount(0);
  await expect(page.locator(".mobile-nav")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBe("done");
  await page.reload();
  await expect(page.locator(".account")).toContainText("Mon espace");
  await expect(page.locator(".welcome-page")).toHaveCount(0);
});
test("compte déjà connecté : restauration directe de la session sans accueil de première ouverture", async ({
  page,
}) => {
  await setup(page, true);
  await page.goto("/");
  await expect(page.locator(".account")).toContainText("Mon espace");
  await expect(page.locator(".welcome-page")).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBe("done");
});
test("lien public Android et site web : accès direct sans présentation imposée", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/#/title/tmdb-movie-42");
  await expect(page.locator(".public-title h1")).toHaveText("Film partagé");
  await expect(page.locator(".welcome-page")).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), welcomeKey),
  ).toBeNull();
  await page.goto("/");
  await expect(page.locator(".welcome-page")).toBeVisible();
  const web = await page.context().newPage();
  await setup(web, false, false);
  await web.goto("/");
  await expect(web.locator(".sidebar")).toHaveCount(1);
  await expect(web.locator(".welcome-page")).toHaveCount(0);
  await web.close();
});

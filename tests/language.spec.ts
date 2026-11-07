import { test, expect, type Page } from "./fixtures";
import { t, setAppLanguage, recommendationReason } from "../src/i18n";
import { validateLanguagePreference } from "../src/language-preferences";
const project = "https://ilrigdnewnsneuwbggqg.supabase.co",
  id = "99999999-9999-4999-8999-999999999999";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "nora@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-11-01T00:00:00Z",
};
const expiry = Date.parse("2028-01-01") / 1000,
  jwt = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({ sub: id, role: "authenticated", exp: expiry }),
    ).toString("base64url"),
    "test",
  ].join(".");
test.use({ baseURL: "http://127.0.0.1:5174" });
async function backend(
  page: Page,
  state: { metadata: any; writes: any[]; fail?: boolean },
  signed = true,
) {
  await page.addInitScript(
    ({ user, expiry, jwt, signed }) => {
      if (signed)
        localStorage.setItem(
          "sb-ilrigdnewnsneuwbggqg-auth-token",
          JSON.stringify({
            access_token: jwt,
            refresh_token: "test",
            token_type: "bearer",
            expires_at: expiry,
            expires_in: 31536000,
            user,
          }),
        );
    },
    { user, expiry, jwt, signed },
  );
  await page.route(project + "/auth/v1/**", (r) => {
    const body = r.request().postDataJSON();
    if (r.request().method() === "PUT") {
      if (state.fail)
        return r.fulfill({ status: 503, json: { msg: "Unavailable" } });
      state.writes.push(body.data);
      state.metadata = { ...state.metadata, ...body.data };
    }
    return r.fulfill({ json: { ...user, user_metadata: state.metadata } });
  });
  await page.route(project + "/rest/v1/**", (r) =>
    r.fulfill({
      json: r.request().url().includes("vela_merge_private_state")
        ? r.request().postDataJSON().items
        : [],
    }),
  );
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const url = new URL(r.request().url()),
      english = url.searchParams.get("language") === "en-US";
    const title = {
      id: 1,
      title: english ? "Space journey" : "Voyage spatial",
      original_title: "Space journey",
      release_date: "2024-01-01",
      overview: english
        ? "An astronaut explores a distant planet."
        : "Une astronaute explore une planète lointaine.",
      genre_ids: [878],
      genres: [
        { id: 878, name: english ? "Science Fiction" : "Science-fiction" },
      ],
      vote_count: 100,
      vote_average: 8,
    };
    if (url.pathname.endsWith("/watch/providers"))
      return r.fulfill({
        json: {
          results: {
            FR: { flatrate: [{ provider_id: 8, provider_name: "Netflix" }] },
          },
        },
      });
    return r.fulfill({
      json: /\/movie\/1$/.test(url.pathname)
        ? title
        : { results: [title], total_results: 1, total_pages: 1 },
    });
  });
}
test("traductions : interpolation, noms conservés, retour au français et langue validée", () => {
  setAppLanguage("en-US");
  expect(t("Réglages")).toBe("Settings");
  expect(t("Saison {0}", 2)).toBe("Season 2");
  expect(
    t("Le catalogue ne répond pas ({0}). Réessayez dans un instant.", 503),
  ).toContain("(503)");
  expect(recommendationReason("Parce que vous avez aimé « Les Goonies »")).toBe(
    "Because you liked “Les Goonies”",
  );
  expect(recommendationReason("Votre goût pour la science-fiction")).toBe(
    "Your taste for science fiction",
  );
  setAppLanguage("fr-FR");
  expect(t("Settings")).toBe("Réglages");
  expect(
    validateLanguagePreference({
      version: 1,
      code: "fr-FR",
      updated: new Date().toISOString(),
    }),
  ).not.toBeNull();
  expect(
    validateLanguagePreference({
      version: 1,
      code: "de-DE",
      updated: new Date().toISOString(),
    }),
  ).toBeNull();
});
test("langue du compte : choix anglais, métadonnées préservées, restauration PC/téléphone et français", async ({
  page,
  browser,
}) => {
  const state = {
    metadata: {
      vela_viewing: {
        version: 1,
        country: "FR",
        providers: [8],
        updated: "2026-11-01T00:00:00Z",
      },
      other: "preserved",
    },
    writes: [] as any[],
  };
  await backend(page, state);
  await page.goto("/#settings");
  await page.getByLabel("Langue", { exact: true }).selectOption("en-US");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect
    .poll(() => state.metadata as any)
    .toHaveProperty("vela_language.code", "en-US");
  expect((state.metadata as any).other).toBe("preserved");
  expect(
    state.writes.some((w) => Object.keys(w).length === 1 && w.vela_language),
  ).toBe(true);
  await expect(
    page.getByRole("option", { name: "United States", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".ai-development-credit")).toHaveText(
    "Developed with AI assistanceChatGPT was used to help develop Vela.",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: test.info().outputPath("Vela-2.6.0-settings-English.png"),
    fullPage: true,
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    }),
    phone = await context.newPage();
  await backend(phone, state);
  await phone.goto("http://127.0.0.1:5174/#settings");
  await expect(phone.getByLabel("Language", { exact: true })).toHaveValue(
    "en-US",
  );
  await expect(
    phone.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await phone.getByLabel("Language", { exact: true }).selectOption("fr-FR");
  await expect
    .poll(() => (state.metadata as any).vela_language.code)
    .toBe("fr-FR");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Réglages", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ai-development-credit")).toContainText(
    "ChatGPT a été utilisé",
  );
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Découvrir", exact: true })
    .click();
  await expect(page.locator(".ai-development-credit")).toHaveCount(0);
  await context.close();
});
test("inscription : langue anglaise et pays français sont deux choix indépendants", async ({
  page,
}) => {
  const state = { metadata: {}, writes: [] as any[] };
  await backend(page, state, false);
  const signups: any[] = [];
  await page.route(project + "/auth/v1/signup*", (r) => {
    signups.push(r.request().postDataJSON());
    return r.fulfill({ json: { user, session: null } });
  });
  await page.goto("/");
  await page.locator(".sidebar .account").click();
  await page.getByLabel("Langue", { exact: true }).selectOption("en-US");
  await page
    .getByRole("button", { name: "Create a free account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("nora@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password1234");
  await page
    .getByLabel("Country of residence", { exact: true })
    .selectOption("FR");
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect.poll(() => signups.length).toBe(1);
  expect(signups[0].data).toMatchObject({
    vela_language: { version: 1, code: "en-US" },
    vela_viewing: { country: "FR" },
  });
});
test("catalogue et fiches : en-US dès la restauration du compte, synopsis et accessibilité en anglais", async ({
  page,
}) => {
  const state = {
    metadata: {
      vela_language: {
        version: 1,
        code: "en-US",
        updated: new Date().toISOString(),
      },
    },
    writes: [] as any[],
  };
  await backend(page, state);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.themoviedb.org")) calls.push(r.url());
  });
  await page.goto("/#/title/tmdb-movie-1");
  await expect(page.locator(".public-title h1")).toHaveText("Space journey");
  await expect(page.locator(".public-title")).toContainText(
    "An astronaut explores a distant planet.",
  );
  await expect(
    page.getByRole("heading", { name: "Synopsis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share this movie page", exact: true }),
  ).toBeVisible();
  expect(
    calls.some((url) => new URL(url).searchParams.get("language") === "en-US"),
  ).toBe(true);
  await page.goto("/#settings");
  await page.getByLabel("Language", { exact: true }).selectOption("fr-FR");
  await page.goto("/#/title/tmdb-movie-1");
  await expect(page.locator(".public-title h1")).toHaveText("Voyage spatial");
  await expect(page.locator(".public-title")).toContainText(
    "Une astronaute explore une planète lointaine.",
  );
});
test("synchronisation en échec : langue conservée au redémarrage puis nouvelle tentative sans perte des autres réglages", async ({
  page,
}) => {
  const state = { metadata: {}, writes: [] as any[], fail: true };
  await backend(page, state);
  await page.goto("/#settings");
  await page.getByLabel("Langue", { exact: true }).selectOption("en-US");
  const section = page.getByRole("region", {
    name: "App language",
    exact: true,
  });
  await expect(section).toContainText("Your language is saved on this device.");
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue(
    "en-US",
  );
  await expect(section).toContainText("Your language is saved on this device.");
  state.fail = false;
  await section.getByRole("button", { name: "Try again", exact: true }).click();
  await expect
    .poll(() => (state.metadata as any).vela_language?.code)
    .toBe("en-US");
  await expect(section.locator(".error")).toHaveCount(0);
});

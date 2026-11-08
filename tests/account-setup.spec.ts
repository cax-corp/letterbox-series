import { test, expect, type Page } from "./fixtures";
import { chooseSetupTitles, applySetupAnswers } from "../src/account-setup";
import { empty } from "../src/store";
import type { Title } from "../src/catalog";
import { readAuthReturn } from "../src/auth-return";
const project = "https://ilrigdnewnsneuwbggqg.supabase.co";
const uid = "99999999-9999-4999-8999-999999999999";
const expiry = Date.parse("2028-01-01") / 1000;
const jwt = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(
    JSON.stringify({ sub: uid, role: "authenticated", exp: expiry }),
  ).toString("base64url"),
  "test",
].join(".");
const examples = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  title: `Cinéma ${i + 1}`,
  release_date: "2004-01-01",
  genre_ids: [[878, 12], [35], [18], [27], [16, 14], [10749], [53], [28]][
    i % 8
  ],
  overview: "Une histoire à découvrir.",
  poster_path: null,
  vote_count: 2500,
  vote_average: 8,
}));
function user(meta: any = {}) {
  return {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "nora@example.com",
    email_confirmed_at: "2026-11-01T10:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: { untouched: "keep", ...meta },
    created_at: "2026-11-01T10:00:00Z",
  };
}
async function setup(page: Page, pending = true, seedSession = true) {
  const state = {
    user: user(
      pending
        ? {
            vela_setup: {
              version: 1,
              status: "pending",
              step: 0,
              updated: "2026-11-01T10:00:00Z",
            },
            vela_viewing: {
              version: 1,
              country: "FR",
              providers: [],
              updated: "2026-11-01T10:00:00Z",
            },
          }
        : {},
    ),
    updates: [] as any[],
    posts: [] as any[],
    rows: new Map<string, any>(),
    failed: false,
    resends: [] as any[],
  };
  if (seedSession)
    await page.addInitScript(
      ({ u, jwt, expiry }) =>
        !localStorage.getItem("sb-ilrigdnewnsneuwbggqg-auth-token") &&
        localStorage.setItem(
          "sb-ilrigdnewnsneuwbggqg-auth-token",
          JSON.stringify({
            access_token: jwt,
            refresh_token: "test",
            expires_at: expiry,
            expires_in: 31536000,
            token_type: "bearer",
            user: u,
          }),
        ),
      { u: state.user, jwt, expiry },
    );
  await page.route(project + "/auth/v1/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/resend")) {
      state.resends.push({
        body: r.request().postDataJSON(),
        redirect: new URL(r.request().url()).searchParams.get("redirect_to"),
      });
      return r.fulfill({ json: {} });
    }
    if (path.endsWith("/user") && r.request().method() === "PUT") {
      const body = r.request().postDataJSON();
      state.updates.push(body);
      if (state.failed)
        return r.fulfill({ status: 503, json: { msg: "Unavailable" } });
      state.user = {
        ...state.user,
        user_metadata: { ...state.user.user_metadata, ...body.data },
      };
    }
    return r.fulfill({ json: state.user });
  });
  await page.route(project + "/rest/v1/library*", (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      state.posts.push(body);
      for (const row of body) state.rows.set(row.title_id, row);
      return r.fulfill({ status: 201, json: [] });
    }
    return r.fulfill({
      json: [...state.rows.values()].map((row) => ({ entry: row.entry })),
    });
  });
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.includes("/watch/providers/"))
      return r.fulfill({
        json: {
          results: [
            { provider_id: 8, provider_name: "Netflix", logo_path: null },
            { provider_id: 337, provider_name: "Disney+", logo_path: null },
          ],
        },
      });
    return r.fulfill({
      json: {
        results: path.includes("/tv/") ? [] : examples,
        total_pages: 3,
        total_results: 60,
      },
    });
  });
  return state;
}

test.use({ baseURL: "http://127.0.0.1:5174" });

test("confirmation : vrai utilisateur confirmé, puis entrée dans la configuration du compte", async ({
  page,
}, testInfo) => {
  await setup(page, true, false);
  await page.goto(
    `/?auth=confirm#access_token=${jwt}&refresh_token=test&expires_in=31536000&token_type=bearer&type=signup`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Votre adresse e-mail est validée.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("main", { name: "Confirmation de l’adresse e-mail" }),
  ).toContainText("nora@example.com");
  await page.screenshot({
    path: testInfo.outputPath("Vela-confirmation-email.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Continuer dans Vela", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Configurons votre profil.",
      exact: true,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("auth")).toBe(false);
});

test("confirmation : erreur explicite et compte non confirmé ne deviennent jamais un succès, renvoi manuel", async ({
  page,
}) => {
  const state = await setup(page, false);
  await page.goto("/?auth=confirm#error=access_denied&error_code=otp_expired");
  await expect(
    page.getByRole("heading", {
      name: "Ce lien ne peut pas être validé.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("nora@example.com");
  await page
    .getByRole("button", { name: "Renvoyer un lien", exact: true })
    .click();
  await expect.poll(() => state.resends.length).toBe(1);
  expect(state.resends[0].body.type).toBe("signup");
  expect(state.resends[0].redirect).toBe("http://127.0.0.1:5174/?auth=confirm");
  state.user.email_confirmed_at = "";
  await page.goto("/?auth=confirm");
  await expect(
    page.getByRole("heading", {
      name: "Ce lien ne peut pas être validé.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Votre adresse e-mail est validée.",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("configuration complète : profil, avatar, palette, pays/services et cinq réponses privées, sans inventer de notes", async ({
  page,
  privateState,
}, testInfo) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("main", { name: "Configuration du profil", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Prénom", { exact: true }).fill("Nora");
  await page.getByLabel("Nom (facultatif)", { exact: true }).fill("Test");
  await page.getByLabel("Nom affiché", { exact: true }).fill("Nora cinéma");
  await page.getByRole("button", { name: "Clin d’œil", exact: true }).click();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Votre Vela, vos couleurs.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Iris grisé", exact: true }).check();
  await page
    .getByLabel("Mode d’affichage", { exact: true })
    .selectOption("light");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(
    page.getByLabel("Pays de résidence", { exact: true }),
  ).toHaveValue("FR");
  await page.getByRole("checkbox", { name: "Netflix", exact: true }).check();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.locator(".setup-movie")).toBeVisible();
  const liked = await page.locator(".setup-movie h3").textContent();
  await page.screenshot({
    path: testInfo.outputPath("Vela-configuration-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "J’aime", exact: true }).click();
  await page
    .getByRole("button", { name: "Je n’aime pas", exact: true })
    .click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Je ne connais pas", exact: true })
      .click();
  expect(state.posts.length).toBe(0);
  expect(
    state.updates.every(
      (v) => !v.data.vela_setup?.titles && !v.data.vela_setup?.answers,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Commencer avec Vela", exact: true })
    .click();
  await expect(
    page.getByRole("main", { name: "Configuration du profil", exact: true }),
  ).toHaveCount(0);
  expect(state.user.user_metadata).toMatchObject({
    untouched: "keep",
    first_name: "Nora",
    last_name: "Test",
    vela_setup: { status: "complete" },
    vela_profile: { displayName: "Nora cinéma", avatar: "wink" },
    vela_viewing: { country: "FR", providers: [8] },
  });
  expect(state.rows.size).toBe(2);
  const entries = [...state.rows.values()].map((r) => r.entry);
  expect(
    entries.find((e) => e.title.name === liked)?.recommendationFeedback,
  ).toBe("like");
  expect(
    entries.filter((e) => e.recommendationFeedback === "dislike"),
  ).toHaveLength(1);
  expect(
    entries.every((e) => !e.watched && !e.favorite && e.rating === 0),
  ).toBe(true);
  expect(privateState.get("palette")?.payload).toEqual({ value: "iris" });
  await page.reload();
  await expect(page.locator(".setup-page")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "iris",
  );
});

test("configuration : échec de sauvegarde récupérable, brouillon conservé après redémarrage, compte existant non forcé", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByLabel("Prénom", { exact: true }).fill("Nora");
  await page.getByLabel("Nom affiché", { exact: true }).fill("Brouillon");
  state.failed = true;
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Vos choix sont conservés",
  );
  await page.reload();
  await expect(page.getByLabel("Nom affiché", { exact: true })).toHaveValue(
    "Brouillon",
  );
  state.failed = false;
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Votre Vela, vos couleurs.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reprendre plus tard", exact: true })
    .click();
  await expect(page.locator(".setup-page")).toHaveCount(0);
  await page.goto("/#settings");
  await page
    .getByRole("button", { name: "Configurer mon profil", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Votre Vela, vos couleurs.",
      exact: true,
    }),
  ).toBeVisible();
});

test("sélection initiale : cinq films variés, aléatoires et uniques ; les réponses ne changent pas les notes/favoris existants", () => {
  const pool: Title[] = examples.map((x) => ({
    id: `tmdb-movie-${x.id}`,
    kind: "movie",
    name: x.title,
    year: "2004",
    image: "",
    summary: "",
    genres: [],
    genreIds: x.genre_ids,
  }));
  const picks = chooseSetupTitles(pool, new Set([pool[0].id]), () => 0.2);
  expect(picks).toHaveLength(5);
  expect(new Set(picks.map((t) => t.id)).size).toBe(5);
  expect(picks.some((t) => t.id === pool[0].id)).toBe(false);
  expect(new Set(picks.flatMap((t) => t.genreIds || [])).size).toBeGreaterThan(
    5,
  );
  const old = { ...empty(pool[1]), rating: 4.5, favorite: true };
  const result = applySetupAnswers(
    { [pool[1].id]: old },
    {
      titles: pool.slice(0, 3),
      answers: {
        [pool[0].id]: "skip",
        [pool[1].id]: "dislike",
        [pool[2].id]: "like",
      },
    },
  );
  expect(result[pool[0].id]).toBeUndefined();
  expect(result[pool[1].id]).toBe(old);
  expect(result[pool[2].id]).toMatchObject({
    rating: 0,
    favorite: false,
    watched: false,
    recommendationFeedback: "like",
  });
  expect(
    readAuthReturn("https://vela.thomasbarial.com/#/title/tmdb-movie-1"),
  ).toBeNull();
  expect(
    readAuthReturn(
      "https://vela.thomasbarial.com/?auth=confirm#error_code=otp_expired",
    )?.error,
  ).toBe("otp_expired");
});

test("configuration en anglais : compte restauré, boutons traduits, écran adaptatif et brouillon de nom conservé", async ({
  page,
}, testInfo) => {
  const state = await setup(page);
  state.user.user_metadata.vela_language = {
    version: 1,
    code: "en-US",
    updated: "2026-11-02T10:00:00Z",
  };
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Let’s set up your profile.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("First name", { exact: true }).fill("Nora");
  await page.getByLabel("Display name", { exact: true }).fill("Nora cinema");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("Vela-profile-setup-English-PC.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Vela, your colors.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Nora cinema",
  );
});

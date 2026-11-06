import { test, expect, type Page } from "@playwright/test";
test.use({ baseURL: "http://127.0.0.1:5174" });
const project = "https://ilrigdnewnsneuwbggqg.supabase.co";
const providers = [
  { provider_id: 8, provider_name: "Netflix", logo_path: "/netflix.png" },
  { provider_id: 9, provider_name: "Prime Video", logo_path: "/prime.png" },
];
const raw = (series = false) => ({
  id: series ? 2 : 1,
  ...(series
    ? { name: "Série publique", first_air_date: "2024-01-01" }
    : { title: "Film public", release_date: "2024-01-01" }),
  overview: series ? "Le résumé de la série." : "Le résumé du film.",
  genre_ids: [18],
  genres: [{ id: 18, name: "Drame" }],
  poster_path: "/poster.jpg",
  vote_count: 100,
  vote_average: 8,
});
async function mock(page: Page) {
  const offers: string[] = [],
    details: string[] = [];
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const u = new URL(r.request().url());
    if (
      u.pathname.includes("/watch/providers/") &&
      !/\/(movie|tv)\/\d+\//.test(u.pathname)
    )
      return r.fulfill({ json: { results: providers } });
    if (u.pathname.endsWith("/watch/providers")) {
      offers.push(u.pathname);
      return r.fulfill({
        json: {
          results: {
            FR: {
              link: "https://www.themoviedb.org/movie/1/watch?locale=FR",
              flatrate: providers,
              rent: [
                { provider_id: 2, provider_name: "Apple TV", logo_path: "" },
              ],
            },
            BE: {
              link: "https://www.themoviedb.org/movie/1/watch?locale=BE",
              flatrate: [providers[1]],
            },
          },
        },
      });
    }
    if (/\/(movie|tv)\/\d+$/.test(u.pathname)) {
      details.push(u.searchParams.get("append_to_response") || "");
      const tv = u.pathname.includes("/tv/");
      return r.fulfill({
        json: {
          ...raw(tv),
          ...(tv
            ? {
                aggregate_credits: {
                  cast: [
                    {
                      id: 30,
                      name: "Sam Interprète",
                      profile_path: "/sam.jpg",
                      roles: [{ character: "Camille" }, { character: "Alex" }],
                    },
                  ],
                },
              }
            : {
                credits: {
                  cast: [
                    {
                      id: 20,
                      name: "Alex Artiste",
                      character: "Lou",
                      profile_path: "/alex.jpg",
                    },
                    {
                      id: 21,
                      name: "Jo Comédien·ne",
                      character: "Morgan",
                      profile_path: null,
                    },
                  ],
                },
              }),
        },
      });
    }
    const tv = u.pathname.includes("/tv/");
    return r.fulfill({
      json: { results: [raw(tv)], total_pages: 1, total_results: 1 },
    });
  });
  await page.route("https://query.wikidata.org/sparql*", (r) =>
    r.fulfill({
      json: {
        results: {
          bindings: [
            {
              identifier: { value: "123456" },
              formatter: { value: "https://www.netflix.com/title/$1" },
            },
          ],
        },
      },
    }),
  );
  await page.route("https://image.tmdb.org/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#a77841"/></svg>',
    }),
  );
  await page.route(project + "/rest/v1/library*", (r) =>
    r.fulfill({ json: [] }),
  );
  return { offers, details };
}
test("pays et abonnements : persistance, offres territoriales, location distincte et trombinoscope", async ({
  page,
}) => {
  const calls = await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#settings");
  await page
    .getByLabel("Pays de résidence", { exact: true })
    .selectOption("FR");
  await page.getByRole("checkbox", { name: "Netflix", exact: true }).check();
  await page.reload();
  await expect(
    page.getByLabel("Pays de résidence", { exact: true }),
  ).toHaveValue("FR");
  await expect(
    page.getByRole("checkbox", { name: "Netflix", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page
    .locator(".hero")
    .getByRole("button", { name: "Découvrir", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    offers = dialog.getByRole("region", { name: "Où regarder", exact: true });
  await expect(
    offers.locator(".watch-provider").filter({ hasText: "Netflix" }),
  ).toBeVisible();
  await expect(offers.locator(".is-subscribed")).toContainText("Netflix");
  await expect(
    offers.getByRole("heading", { name: "À louer", exact: true }),
  ).toBeVisible();
  await expect(
    offers.getByRole("link", { name: "Ouvrir le titre ↗", exact: true }),
  ).toHaveAttribute("href", "https://www.netflix.com/title/123456");
  const cast = dialog.getByRole("region", {
    name: "Distribution",
    exact: true,
  });
  await expect(cast.getByText("Alex Artiste", { exact: true })).toBeVisible();
  await expect(cast.getByText("Lou", { exact: true })).toBeVisible();
  await expect(
    cast.getByRole("img", { name: "Alex Artiste", exact: true }),
  ).toHaveAttribute("src", /w185\/alex.jpg$/);
  expect(calls.details).toContain("videos,external_ids,credits");
  await page.screenshot({ path: "tests/availability-dark.png" });
  await offers.getByRole("button", { name: /Modifier/ }).click();
  await page
    .getByLabel("Pays de résidence", { exact: true })
    .selectOption("BE");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page
    .locator(".hero")
    .getByRole("button", { name: "Découvrir", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Où regarder", exact: true })
      .getByText("Prime Video", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Où regarder", exact: true })
      .getByText("Netflix", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("lien de série : fiche complète anonyme et rôles du casting agrégé, sans formulaire d’avis privé", async ({
  page,
}) => {
  const calls = await mock(page);
  await page.goto("/#/title/tmdb-series-2");
  await expect(page.locator(".public-title")).toContainText("Série publique");
  await expect(page.locator(".public-title")).toContainText(
    "Le résumé de la série.",
  );
  await expect(
    page.getByRole("region", { name: "Distribution", exact: true }),
  ).toContainText("Camille / Alex");
  await expect(
    page.getByRole("button", {
      name: "Se connecter pour noter ou ajouter à ma liste",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Votre critique", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.details).toEqual(["videos,external_ids,aggregate_credits"]);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator(".public-title")).toContainText("Série publique");
});
test("création de compte : pays obligatoire dans les métadonnées privées Supabase", async ({
  page,
}) => {
  await mock(page);
  let signup: any = null;
  await page.route(project + "/auth/v1/signup*", (r) => {
    signup = r.request().postDataJSON();
    return r.fulfill({
      json: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "nora@example.com",
          user_metadata: signup.data,
        },
        session: null,
      },
    });
  });
  await page.goto("/");
  await page.locator(".sidebar .account").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Créer un compte gratuit", exact: true })
    .click();
  await dialog.getByLabel("E-mail", { exact: true }).fill("nora@example.com");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await dialog
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  expect(signup).toBe(null);
  await dialog
    .getByLabel("Pays de résidence", { exact: true })
    .selectOption("CA");
  await dialog
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect.poll(() => signup?.data?.vela_viewing?.country).toBe("CA");
  expect(signup.data.vela_viewing.providers).toEqual([]);
});

test("compte : pays et services synchronisés puis restaurés après effacement du cache local", async ({
  page,
}) => {
  await mock(page);
  const id = "77777777-7777-4777-8777-777777777777",
    expiry = Math.floor(Date.now() / 1000) + 86400;
  let metadata: any = {
    vela_viewing: {
      version: 1,
      country: "FR",
      providers: [8],
      updated: new Date(Date.now() - 3600000).toISOString(),
    },
    keep: "private-metadata",
  };
  const user = {
    id,
    email: "nora@example.com",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: metadata,
  };
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ sub: id, exp: expiry })).toString("base64url"),
    "fake-signature",
  ].join(".");
  const writes: any[] = [];
  await page.route(project + "/auth/v1/**", async (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON();
      writes.push(body);
      metadata = { ...metadata, ...body.data };
    }
    return r.fulfill({ json: { ...user, user_metadata: metadata } });
  });
  await page.addInitScript(
    ({ user, token, expiry }) => {
      const key = "sb-ilrigdnewnsneuwbggqg-auth-token";
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: token,
            refresh_token: "fake-refresh",
            expires_at: expiry,
            expires_in: 86400,
            token_type: "bearer",
            user,
          }),
        );
    },
    { user, token, expiry },
  );
  await page.goto("/#settings");
  await expect(
    page.getByLabel("Pays de résidence", { exact: true }),
  ).toHaveValue("FR");
  await expect(
    page.getByRole("checkbox", { name: "Netflix", exact: true }),
  ).toBeChecked();
  await page
    .getByLabel("Pays de résidence", { exact: true })
    .selectOption("BE");
  await page
    .getByRole("checkbox", { name: "Prime Video", exact: true })
    .check();
  await expect
    .poll(() => metadata.vela_viewing)
    .toMatchObject({ country: "BE", providers: [9] });
  expect(
    writes.every((w) => Object.keys(w.data).every((k) => k === "vela_viewing")),
  ).toBe(true);
  expect(metadata.keep).toBe("private-metadata");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("vela-viewing-v1:")) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(
    page.getByLabel("Pays de résidence", { exact: true }),
  ).toHaveValue("BE");
  await expect(
    page.getByRole("checkbox", { name: "Prime Video", exact: true }),
  ).toBeChecked();
});

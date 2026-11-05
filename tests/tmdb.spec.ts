import { test, expect } from "@playwright/test";
const fakeKey = "1234567890abcdef1234567890abcdef";
const movie = {
  id: 1,
  title: "Le Film Introuvable",
  original_title: "The Missing Film",
  release_date: "2024-05-01",
  poster_path: null,
  backdrop_path: "/landscape.jpg",
  overview: "Un film au-delà du catalogue de la boutique.",
  genre_ids: [18],
  vote_count: 200,
  vote_average: 8.2,
};
const tv = {
  id: 2,
  name: "La Série Introuvable",
  original_name: "Missing Show",
  first_air_date: "2023-01-01",
  poster_path: null,
  overview: "Une série internationale.",
  genre_ids: [18],
  vote_count: 300,
  vote_average: 8.7,
};
async function setup(page: any, configured = true) {
  if (configured)
    await page.addInitScript(
      (key: string) => localStorage.setItem("luma-tmdb-token", key),
      fakeKey,
    );
  await page.route("**/image.tmdb.org/**", (r: any) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#064c6a"/></svg>',
    }),
  );
  await page.route("https://api.themoviedb.org/3/**", (r: any) => {
    const url = new URL(r.request().url());
    const path = url.pathname;
    if (path.endsWith("/configuration"))
      return r.fulfill({
        json: { images: { secure_base_url: "https://image.tmdb.org/t/p/" } },
      });
    if (path.includes("/season/"))
      return r.fulfill({
        json: {
          episodes: [
            {
              id: 201,
              season_number: 1,
              episode_number: 1,
              name: "Le premier jour",
            },
            { id: 202, season_number: 1, episode_number: 2, name: "La suite" },
          ],
        },
      });
    if (path.endsWith("/movie/1"))
      return r.fulfill({
        json: {
          ...movie,
          genres: [{ id: 18, name: "Drame" }],
          runtime: 127,
          videos: {
            results: [
              { site: "YouTube", type: "Trailer", key: "trailer_demo" },
            ],
          },
          external_ids: { imdb_id: "tt1234567" },
        },
      });
    if (path.endsWith("/tv/2"))
      return r.fulfill({
        json: {
          ...tv,
          genres: [{ id: 18, name: "Drame" }],
          seasons: [
            { season_number: 1, name: "Saison 1", episode_count: 2 },
            { season_number: 2, name: "Saison 2", episode_count: 3 },
          ],
          number_of_episodes: 5,
          external_ids: { imdb_id: "tt7654321" },
        },
      });
    const isTv = path.includes("/tv");
    const second = url.searchParams.get("page") === "2";
    return r.fulfill({
      json: {
        page: second ? 2 : 1,
        total_pages: 2,
        total_results: 2,
        results: second
          ? [
              {
                ...(isTv ? tv : movie),
                id: isTv ? 4 : 3,
                ...(isTv
                  ? { name: "Une autre série" }
                  : { title: "Un autre film" }),
              },
            ]
          : [isTv ? tv : movie],
      },
    });
  });
}
test("TMDB: recherche films/séries sans affiche, pagination et fiches IMDb", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await expect(
    page.getByText("Élargissez votre catalogue avec TMDB"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Explorer", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Rechercher dans le catalogue" })
    .fill("Introuvable");
  await expect(
    page.getByRole("button", { name: /Le Film Introuvable/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /La Série Introuvable/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Charger plus de résultats" }).click();
  await expect(
    page.getByRole("button", { name: /Un autre film/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Charger plus de résultats" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Le Film Introuvable/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("127 min", { exact: false })).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /Fiche IMDb/ }),
  ).toHaveAttribute("href", "https://www.imdb.com/title/tt1234567/");
  await expect(
    dialog.getByRole("link", { name: /bande-annonce/ }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=trailer_demo");
  await expect(dialog.getByText("/10 · TMDB")).toBeVisible();
  await dialog.getByRole("button", { name: "À voir", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Noter 5 sur 5", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await expect(
    page.getByRole("button", { name: /Le Film Introuvable/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("luma-library-v1") || "{}")[
          "tmdb-movie-1"
        ].rating,
    ),
  ).toBe(5);
});
test("TMDB: saisons chargées à l’ouverture, erreur de saison et progression persistante", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  let fails = true;
  await page.route("**/tv/2/season/1*", (r) => {
    calls++;
    return fails
      ? r.fulfill({ status: 503, json: {} })
      : r.fulfill({
          json: {
            episodes: [
              {
                id: 201,
                season_number: 1,
                episode_number: 1,
                name: "Le premier jour",
              },
              {
                id: 202,
                season_number: 1,
                episode_number: 2,
                name: "La suite",
              },
            ],
          },
        });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /La Série Introuvable/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Saison 1", { exact: false })).toBeVisible();
  expect(calls).toBe(0);
  await dialog.locator("summary").filter({ hasText: "Saison 1" }).click();
  await expect(
    dialog.getByText("Cette saison n’a pas pu être chargée."),
  ).toBeVisible();
  fails = false;
  await dialog.getByRole("button", { name: "Réessayer la saison" }).click();
  await dialog.getByRole("checkbox", { name: /Le premier jour/ }).check();
  await expect(
    dialog.getByRole("heading", { name: /Votre progression 1 \/ 5/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "À voir", exact: true }).click();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await page.getByRole("button", { name: /La Série Introuvable/ }).click();
  await page
    .getByRole("dialog")
    .locator("summary")
    .filter({ hasText: "Saison 1" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Le premier jour/ }),
  ).toBeChecked();
});
test("activation: clé vérifiée avant enregistrement, erreurs explicites et aucune perte des anciennes notes", async ({
  page,
}) => {
  await setup(page, false);
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.addInitScript(() => {
    const title = {
      id: "movie-1",
      kind: "movie",
      name: "Ancienne note",
      year: "2000",
      image: "",
      summary: "Mon film",
      genres: [],
    };
    localStorage.setItem(
      "luma-library-v1",
      JSON.stringify({
        "movie-1": {
          title,
          watchlist: true,
          watched: true,
          rating: 4,
          review: "À conserver",
          favorite: false,
          updated: new Date().toISOString(),
          watchedAt: "2026-11-05",
          episodes: [],
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Configurer TMDB" }).click();
  const dialog = page.getByRole("region", { name: "Réglages", exact: true });
  await dialog.getByLabel("Jeton de lecture TMDB ou clé API").fill(fakeKey);
  await page.route("**/configuration*", (r) =>
    r.fulfill({ status: 401, json: { status_message: "bad key" } }),
  );
  await dialog
    .getByRole("button", { name: "Activer TMDB", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("TMDB refuse la clé");
  expect(
    await page.evaluate(() => localStorage.getItem("luma-tmdb-token")),
  ).toBeNull();
  await page.unroute("**/configuration*");
  await dialog
    .getByRole("button", { name: "Activer TMDB", exact: true })
    .click();
  await expect(
    page.getByText("Élargissez votre catalogue avec TMDB"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await expect(
    page.getByRole("button", { name: /Ancienne note/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Découvrir", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Le Film Introuvable/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "À voir", exact: true })
    .click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("luma-library-v1") || "{}"),
  );
  expect(data["movie-1"].review).toBe("À conserver");
  expect(data["tmdb-movie-1"].title.source).toBe("tmdb");
  expect(JSON.stringify(data)).not.toContain(fakeKey);
});
test("authentification v4 et paramètres français, sans repli silencieux après refus", async ({
  page,
}) => {
  const token = "eyJ0ZXN0.eyJ0ZXN0.c2lnbmF0dXJl";
  await page.addInitScript(
    (t) => localStorage.setItem("luma-tmdb-token", t),
    token,
  );
  let sawAuth = false;
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const u = new URL(r.request().url());
    sawAuth =
      r.request().headers().authorization === `Bearer ${token}` &&
      u.searchParams.get("language") === "fr-FR" &&
      !u.searchParams.has("api_key");
    return r.fulfill({ status: 401, json: {} });
  });
  let legacyRequests = 0;
  await page.route("**/itunes.apple.com/**", (r) => {
    legacyRequests++;
    return r.fulfill({ json: { results: [] } });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("TMDB refuse la clé");
  expect(sawAuth).toBe(true);
  expect(legacyRequests).toBe(0);
});

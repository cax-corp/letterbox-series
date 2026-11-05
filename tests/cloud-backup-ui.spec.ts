import { test, expect, type Page } from "@playwright/test";
import { DAY, backupKey } from "../src/backup";
import { empty, type Entry, type Library } from "../src/store";
const id = "11111111-1111-4111-8111-111111111111",
  project = "https://vela-backup-test.supabase.co";
async function setup(
  page: Page,
  options: { remote?: Library; hold?: Promise<void> } = {},
) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-11-05T12:00:00Z") });
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "backup@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-11-01T00:00:00Z",
  };
  const expiry = Date.parse("2028-01-01T00:00:00Z") / 1000;
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({ sub: id, role: "authenticated", exp: expiry }),
    ).toString("base64url"),
    "fake-signature",
  ].join(".");
  await page.addInitScript(
    ({ project, user, jwt, expiry }) => {
      localStorage.setItem(
        "luma-cloud",
        JSON.stringify({ url: project, key: "sb_publishable_test" }),
      );
      const key = "sb-vela-backup-test-auth-token";
      // Seed once: reload must exercise persisted backup state and pending local changes.
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: jwt,
            refresh_token: "fake-refresh",
            expires_at: expiry,
            expires_in: 365 * 24 * 3600,
            token_type: "bearer",
            user,
          }),
        );
        sessionStorage.setItem("seeded", "yes");
      }
    },
    { project, user, jwt, expiry },
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({
      json: {
        results: [
          {
            trackId: 1,
            trackName: "Interstellar",
            releaseDate: "2014-11-05",
            artworkUrl100: "",
            longDescription: "Voyage spatial.",
            primaryGenreName: "Science-fiction",
          },
        ],
      },
    }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.route(project + "/auth/v1/**", (r) =>
    r.fulfill({ json: r.request().url().includes("/logout") ? {} : user }),
  );
  let reads = 0;
  const writes: any[][] = [];
  const remote: Library = { ...options.remote };
  await page.route(project + "/rest/v1/library*", async (r) => {
    if (r.request().method() === "GET") {
      reads++;
      if (options.hold) await options.hold;
      await r.fulfill({
        json: Object.values(remote).map((entry) => ({ entry })),
      });
    } else {
      const rows = r.request().postDataJSON();
      writes.push(rows);
      for (const row of rows) remote[row.title_id] = row.entry;
      await r.fulfill({ status: 201, json: [] });
    }
  });
  await page.goto("/");
  return { reads: () => reads, writes, remote };
}
async function edit(page: Page) {
  await page.getByRole("button", { name: /Interstellar/ }).click();
  const detail = page.getByRole("dialog");
  await detail
    .getByRole("button", { name: "Coup de cœur", exact: true })
    .click();
  await detail.getByRole("button", { name: "À voir", exact: true }).click();
  await detail
    .getByRole("button", { name: "Noter 4 sur 5", exact: true })
    .click();
  await detail.getByRole("button", { name: "Fermer", exact: true }).click();
}
const meta = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    backupKey(project, id),
  );
test("sauvegarde groupée quotidienne : aucun envoi à chaque like, ni au redémarrage ; reprise après retour du réseau", async ({
  page,
  context,
}) => {
  const x = await setup(page);
  await expect.poll(x.reads).toBe(1);
  await expect
    .poll(async () => Boolean((await meta(page)).lastSuccess))
    .toBe(true);
  await edit(page);
  expect(x.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await expect(
    page.getByText(/attendent la prochaine sauvegarde Supabase/),
  ).toBeVisible();
  await page.reload();
  expect(x.reads()).toBe(1);
  await context.setOffline(true);
  await page.clock.fastForward(DAY + 60000);
  expect(x.reads()).toBe(1);
  expect(x.writes).toHaveLength(0);
  await context.setOffline(false);
  await expect.poll(x.reads).toBe(2);
  await expect.poll(() => x.writes.length).toBe(1);
  expect(x.writes[0]).toHaveLength(1);
  expect(x.writes[0][0].entry).toMatchObject({
    favorite: true,
    watchlist: true,
    rating: 4,
  });
  await page.reload();
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("online"));
  });
  expect(x.reads()).toBe(2);
  expect(x.writes).toHaveLength(1);
});
test("réglages : manuel sans requêtes automatiques, sauvegarde immédiate et fréquence hebdomadaire persistée", async ({
  page,
}) => {
  const x = await setup(page);
  await expect
    .poll(async () => Boolean((await meta(page)).lastSuccess))
    .toBe(true);
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const region = page.getByRole("region", {
    name: "Sauvegarde Supabase",
    exact: true,
  });
  await expect(region.getByLabel("Fréquence de sauvegarde")).toHaveValue(
    "daily",
  );
  await region.getByLabel("Fréquence de sauvegarde").selectOption("manual");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await edit(page);
  await page.clock.fastForward(8 * DAY);
  expect(x.reads()).toBe(1);
  expect(x.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await region
    .getByRole("button", { name: "Sauvegarder maintenant", exact: true })
    .click();
  await expect(
    region.getByText("Copie Supabase à jour", { exact: true }),
  ).toBeVisible();
  expect(x.reads()).toBe(2);
  expect(x.writes).toHaveLength(1);
  await region.getByLabel("Fréquence de sauvegarde").selectOption("weekly");
  await page.reload();
  await expect(region.getByLabel("Fréquence de sauvegarde")).toHaveValue(
    "weekly",
  );
  await page.clock.fastForward(7 * DAY - 60000);
  expect(x.reads()).toBe(2);
  await page.clock.fastForward(120000);
  await expect.poll(x.reads).toBe(3);
  expect(x.writes).toHaveLength(1);
  await expect(
    region.getByText("Copie Supabase à jour", { exact: true }),
  ).toBeVisible();
  await region.screenshot({ path: "tests/cloud-backup-settings.png" });
});
test("une réponse distante arrivée après déconnexion ne remplace pas la collection locale anonyme", async ({
  page,
}) => {
  let release!: () => void;
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const title = {
    id: "movie-9",
    kind: "movie" as const,
    name: "Film privé du compte",
    year: "2024",
    image: "",
    summary: "Synopsis",
    genres: [],
  };
  const entry: Entry = {
    ...empty(title),
    favorite: true,
    updated: "2026-11-05T10:00:00Z",
    watchedAt: "2026-11-05",
  };
  const x = await setup(page, { remote: { [title.id]: entry }, hold });
  await expect.poll(x.reads).toBe(1);
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await expect(
    page.getByText("Le premier rôle, c’est vous.", { exact: true }),
  ).toBeVisible();
  release();
  await expect
    .poll(async () => Boolean((await meta(page)).lastSuccess))
    .toBe(true);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Film privé du compte/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("luma-library-v1") || "{}"),
    ),
  ).toEqual({});
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem("luma-library-v1-" + id) || "{}")[
          "movie-9"
        ]?.favorite,
      id,
    ),
  ).toBe(true);
});

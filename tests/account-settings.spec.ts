import { test, expect, type Page } from "./fixtures";
import {
  mergePreferenceRecords,
  type AccountPreferences,
} from "../src/account-state";
const project = "https://ilrigdnewnsneuwbggqg.supabase.co",
  id = "88888888-8888-4888-8888-888888888888";
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
    "fake-signature",
  ].join(".");
type Row = { key: string; payload: any; updated_at: string };
async function setup(
  page: Page,
  rows: Map<string, Row>,
  writes: Row[][],
  native = false,
  granted = true,
) {
  await page.addInitScript(
    ({ user, jwt, expiry, native, granted }) => {
      localStorage.setItem("vela-welcome-v1", "done");
      if (!localStorage.getItem("sb-ilrigdnewnsneuwbggqg-auth-token"))
        localStorage.setItem(
          "sb-ilrigdnewnsneuwbggqg-auth-token",
          JSON.stringify({
            access_token: jwt,
            refresh_token: "test-refresh",
            expires_at: expiry,
            expires_in: 31536000,
            token_type: "bearer",
            user,
          }),
        );
      if (native) {
        const w = window as any;
        w.CapacitorCustomPlatform = { name: "android" };
        w.nativeCalls = [];
        const state: any = {
          config: {
            enabled: false,
            hour: 19,
            minute: 0,
            days: [0, 1, 2, 3, 4, 5, 6],
          },
          granted,
          nextAt: 0,
          exactAllowed: true,
        };
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
            {
              name: "DailyRecommendations",
              methods: [
                "getState",
                "configure",
                "updateContext",
                "requestNotificationPermission",
                "addListener",
                "removeListener",
              ].map((name) => ({ name, rtype: "promise" })),
            },
          ],
          nativePromise: async (
            plugin: string,
            method: string,
            options: any,
          ) => {
            w.nativeCalls.push({ plugin, method, options });
            if (plugin !== "DailyRecommendations") return {};
            if (method === "requestNotificationPermission") {
              state.granted = true;
              return { granted: true };
            }
            if (method === "configure") state.config = options.config;
            if (method === "updateContext")
              state.config = { ...state.config, ...options.context };
            return JSON.parse(JSON.stringify(state));
          },
        };
      }
    },
    { user, jwt, expiry, native, granted },
  );
  await page.route("https://api.themoviedb.org/3/**", (r) =>
    r.fulfill({ json: { results: [], total_pages: 1, total_results: 0 } }),
  );
  await page.route(project + "/auth/v1/**", (r) => r.fulfill({ json: user }));
  await page.route(project + "/rest/v1/library*", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route(project + "/rest/v1/vela_private_state?**", (r) =>
    r.fulfill({ json: [...rows.values()] }),
  );
  await page.route(project + "/rest/v1/rpc/vela_merge_private_state", (r) => {
    const sent = r.request().postDataJSON().items as Row[];
    writes.push(sent);
    for (const row of sent) {
      const old = rows.get(row.key);
      if (!old || Date.parse(row.updated_at) > Date.parse(old.updated_at))
        rows.set(row.key, row);
    }
    return r.fulfill({ json: sent.map((row) => rows.get(row.key)) });
  });
}
const defaults = () =>
  new Map<string, Row>([
    [
      "palette",
      {
        key: "palette",
        payload: { value: "iris" },
        updated_at: "2026-11-01T00:00:00+00:00",
      },
    ],
    [
      "theme",
      {
        key: "theme",
        payload: { value: "light" },
        updated_at: "2026-11-01T00:00:00+00:00",
      },
    ],
    [
      "backupFrequency",
      {
        key: "backupFrequency",
        payload: { value: "manual" },
        updated_at: "2026-11-01T00:00:00+00:00",
      },
    ],
    [
      "notifications",
      {
        key: "notifications",
        payload: {
          value: { enabled: true, hour: 19, minute: 45, days: [1, 3, 5] },
        },
        updated_at: "2026-11-01T00:00:00+00:00",
      },
    ],
  ]);
test.use({ baseURL: "http://127.0.0.1:5174" });
test("les formats d’horodatage PostgreSQL confirment le même instant sans laisser un faux changement en attente", () => {
  const local: AccountPreferences = {
    palette: {
      key: "palette",
      payload: { value: "iris" },
      updated_at: "2026-11-07T12:00:00.000Z",
      synced: false,
    },
  };
  expect(
    mergePreferenceRecords(local, [
      {
        key: "palette",
        payload: { value: "iris" },
        updated_at: "2026-11-07T12:00:00+00:00",
      },
    ]).palette?.synced,
  ).toBe(true);
  const later = { ...local.palette!, updated_at: "2026-11-07T13:00:00Z" };
  expect(
    mergePreferenceRecords({ palette: later }, [
      {
        key: "palette",
        payload: { value: "blue" },
        updated_at: "2026-11-07T12:00:00Z",
      },
    ]).palette,
  ).toEqual(later);
});
test("PC vers téléphone : palette, thème et notification restaurés, sans demande automatique d’autorisation", async ({
  page,
  browser,
}) => {
  const rows = defaults(),
    writes: Row[][] = [];
  await setup(page, rows, writes);
  await page.goto("/#settings");
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "iris",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByLabel("Fréquence de sauvegarde")).toHaveValue(
    "manual",
  );
  await page.getByRole("radio", { name: "Rubis", exact: true }).check();
  await expect.poll(() => rows.get("palette")?.payload.value).toBe("ruby");
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    phone = await context.newPage();
  await setup(phone, rows, writes, true, true);
  await phone.goto("/#settings");
  await expect(phone.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "ruby",
  );
  await expect(phone.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(phone.getByLabel("Heure de la recommandation")).toHaveValue(
    "19:45",
  );
  await expect(
    phone.getByRole("checkbox", {
      name: "Recevoir une recommandation",
      exact: true,
    }),
  ).toBeChecked();
  await expect
    .poll(() =>
      phone.evaluate(() =>
        (window as any).nativeCalls.some(
          (call: any) =>
            call.method === "configure" &&
            call.options.config.enabled &&
            call.options.config.hour === 19 &&
            call.options.config.minute === 45,
        ),
      ),
    )
    .toBe(true);
  expect(
    await phone.evaluate(() =>
      (window as any).nativeCalls.some(
        (call: any) => call.method === "requestNotificationPermission",
      ),
    ),
  ).toBe(false);
  await phone.getByRole("radio", { name: "Émeraude", exact: true }).check();
  await expect.poll(() => rows.get("palette")?.payload.value).toBe("emerald");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "emerald",
  );
  await expect(
    phone.getByRole("button", { name: "Tester maintenant", exact: true }),
  ).toHaveCount(0);
  await expect(
    phone.getByText("Sur Xiaomi / HyperOS", { exact: true }),
  ).toHaveCount(0);
  await context.close();
});
test("un nouveau téléphone sans autorisation garde l’horaire du compte mais demande une action explicite pour l’activer", async ({
  page,
}) => {
  const rows = defaults(),
    writes: Row[][] = [];
  await setup(page, rows, writes, true, false);
  await page.goto("/#settings");
  await expect(page.getByLabel("Heure de la recommandation")).toHaveValue(
    "19:45",
  );
  expect(
    await page.evaluate(() =>
      (window as any).nativeCalls.some(
        (call: any) => call.method === "requestNotificationPermission",
      ),
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Enregistrer l’horaire", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).nativeCalls.some(
          (call: any) => call.method === "requestNotificationPermission",
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByText("Horaire enregistré.", { exact: true }),
  ).toBeVisible();
  const days = page
    .getByRole("group", { name: "Jours des notifications" })
    .getByRole("button");
  for (const day of await days.all())
    if ((await day.getAttribute("aria-pressed")) === "true") await day.click();
  await page
    .getByRole("checkbox", { name: "Recevoir une recommandation", exact: true })
    .uncheck();
  await expect(
    page.getByRole("button", { name: "Enregistrer l’horaire", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Enregistrer l’horaire", exact: true })
    .click();
  await expect(
    page.getByText("Les notifications sont désactivées.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => rows.get("notifications")?.payload.value.enabled)
    .toBe(false);
});
test("signaux de goût : aucune écriture au geste, envoi groupé manuel puis restauration sur un autre appareil", async ({
  page,
  browser,
}) => {
  const rows = defaults(),
    writes: Row[][] = [];
  await setup(page, rows, writes);
  await page.goto("/#settings");
  await expect(page.getByLabel("Fréquence de sauvegarde")).toHaveValue(
    "manual",
  );
  await page.evaluate(async (account) => {
    const { rememberQuickSkip } = await import("/src/implicit-feedback.ts");
    rememberQuickSkip(
      {
        id: "tmdb-movie-42",
        kind: "movie",
        source: "tmdb",
        name: "Un film passé",
        year: "2024",
        image: "",
        summary: "Une mission spatiale.",
        genres: ["Science-fiction"],
        genreIds: [878],
      },
      800,
      account,
    );
  }, id);
  await page.waitForTimeout(2800);
  expect(writes.flat().some((row) => row.key.startsWith("skip:"))).toBe(false);
  await page
    .getByRole("button", { name: "Sauvegarder maintenant", exact: true })
    .click();
  await expect.poll(() => rows.has("skip:tmdb-movie-42")).toBe(true);
  expect(rows.get("skip:tmdb-movie-42")?.payload.title.image).toBe("");
  const context = await browser.newContext(),
    other = await context.newPage();
  await setup(other, rows, writes);
  await other.goto("/#settings");
  await expect
    .poll(() =>
      other.evaluate(async (account) => {
        const { readSkipSignals } = await import("/src/implicit-feedback.ts");
        return readSkipSignals(account).map((item) => item.title.id);
      }, id),
    )
    .toContain("tmdb-movie-42");
  await context.close();
});

test("sauvegarde manuelle : une nouvelle connexion restaure tout de même les favoris sans envoyer la collection", async ({
  page,
}) => {
  const rows = defaults(),
    writes: Row[][] = [];
  await setup(page, rows, writes);
  const entry = {
    title: {
      id: "tmdb-movie-3",
      kind: "movie",
      name: "Mon favori conservé",
      year: "2020",
      image: "",
      summary: "Un récit.",
      genres: ["Drame"],
    },
    favorite: true,
    watched: true,
    watchlist: false,
    rating: 5,
    review: "Mon avis.",
    episodes: [],
    watchedAt: "2026-11-01",
    updated: "2026-11-01T12:00:00Z",
  };
  let uploads = 0;
  await page.route(project + "/rest/v1/library*", (route) => {
    if (route.request().method() !== "GET") uploads++;
    return route.fulfill({ json: [{ entry }] });
  });
  await page.goto("/#settings");
  await expect(page.getByLabel("Fréquence de sauvegarde")).toHaveValue(
    "manual",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (account) =>
          JSON.parse(
            localStorage.getItem("luma-library-v1-" + account) || "{}",
          )["tmdb-movie-3"]?.favorite,
        id,
      ),
    )
    .toBe(true);
  expect(uploads).toBe(0);
});
test("échec de synchronisation : changement conservé, pas de boucle de requêtes, reprise explicite", async ({
  page,
}) => {
  const rows = defaults(),
    writes: Row[][] = [];
  await setup(page, rows, writes);
  let attempts = 0,
    fail = true;
  await page.route(
    project + "/rest/v1/rpc/vela_merge_private_state",
    (route) => {
      attempts++;
      if (fail)
        return route.fulfill({
          status: 503,
          json: { message: "Service temporairement indisponible" },
        });
      const items = route.request().postDataJSON().items as Row[];
      for (const row of items) rows.set(row.key, row);
      return route.fulfill({ json: items });
    },
  );
  await page.goto("/#settings");
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "iris",
  );
  await page.getByRole("radio", { name: "Rubis", exact: true }).check();
  await expect(
    page.getByText("Service temporairement indisponible", { exact: true }),
  ).toBeVisible();
  const count = attempts;
  await page.waitForTimeout(3000);
  expect(attempts).toBe(count);
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "ruby",
  );
  fail = false;
  await page
    .getByRole("button", {
      name: "Réessayer la synchronisation des réglages",
      exact: true,
    })
    .click();
  await expect.poll(() => rows.get("palette")?.payload.value).toBe("ruby");
  await expect(
    page.getByText("Réglages en attente de synchronisation.", { exact: true }),
  ).toHaveCount(0);
});

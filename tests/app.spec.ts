import { test, expect } from "./fixtures";
const movie = {
  trackId: 1,
  trackName: "Interstellar",
  releaseDate: "2014-11-05",
  artworkUrl100: "",
  longDescription: "Un voyage au-delà de notre galaxie.",
  primaryGenreName: "Science-fiction",
};
const show = {
  id: 2,
  name: "Severance",
  premiered: "2022-02-18",
  image: { original: "https://example.com/poster.svg" },
  summary: "<p>Deux vies, une seule personne.</p>",
  genres: ["Drama"],
  rating: { average: 9.1 },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [movie] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) =>
    r.fulfill({
      json: r.request().url().includes("/episodes")
        ? [{ id: 101, name: "Good News About Hell", season: 1, number: 1 }]
        : r.request().url().includes("/search/")
          ? [{ show }]
          : [show],
    }),
  );
  await page.route("https://example.com/poster.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#184753"/><circle cx="300" cy="300" r="150" fill="#009fe3"/></svg>',
    }),
  );
});
test("catalogue, avis, listes et persistance locale", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Interstellar/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Un voyage au-delà")).toBeVisible();
  await dialog.getByRole("button", { name: "À voir", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Noter 4 sur 5", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Écrire un avis", exact: true })
    .click();
  await dialog.getByLabel("Votre critique").fill("Un souvenir cosmique.");
  await dialog.getByRole("button", { name: "Enregistrer mon avis" }).click();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await page.getByRole("button", { name: /^Vus/ }).click();
  await page.getByRole("button", { name: /Interstellar/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Modifier mon avis", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Votre critique"),
  ).toHaveValue("Un souvenir cosmique.");
  await page
    .getByRole("dialog")
    .getByLabel("Votre critique")
    .fill("Un brouillon non enregistré");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Annuler", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Votre critique"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog")
      .getByText("Un souvenir cosmique.", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Interstellar/ }),
  ).toBeVisible();
});
test("recherche et progression des épisodes", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explorer", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Rechercher dans le catalogue" })
    .fill("Severance");
  await page.getByRole("button", { name: /Severance/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Saison 1").click();
  await dialog.getByRole("checkbox").check();
  await expect(
    dialog.getByRole("heading", { name: /Votre progression 1 \/ 1/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("mobile sans débordement, navigation et thème sombre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Films et séries", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Vela/);
  await expect(page.locator(".mobile-logo")).toContainText("vela");
  await expect(
    page.getByText("A CAX Corporation company", { exact: true }),
  ).toHaveCount(0);
  const hierarchy = await page.evaluate(() => {
    const heading = getComputedStyle(document.querySelector(".intro h1")!);
    const featured = getComputedStyle(document.querySelector(".hero h2")!);
    return {
      ratio: parseFloat(heading.fontSize) / parseFloat(featured.fontSize),
      headingWeight: Number(heading.fontWeight),
      featuredWeight: Number(featured.fontWeight),
    };
  });
  expect(hierarchy.ratio).toBeLessThan(1);
  expect(hierarchy.headingWeight).toBeLessThan(hierarchy.featuredWeight);
  await page.screenshot({ path: "tests/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Profil" })
    .click();
  await expect(page.getByText("Le premier rôle, c’est vous.")).toBeVisible();
});
test("échecs réseau: message et collection accessible", async ({ page }) => {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Vos listes restent accessibles",
  );
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await expect(
    page.getByText("Votre collection est vide.", { exact: true }),
  ).toBeVisible();
});

test("listes nommées et export de la collection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Interstellar/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Suivi personnel", { exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Vos listes personnelles" })
    .fill("Mes classiques, Soirée cinéma");
  await dialog.getByRole("heading", { name: "Synopsis" }).click();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: /Ma collection/ }).click();
  await page.getByRole("button", { name: /Mes classiques/ }).click();
  await expect(
    page.getByRole("button", { name: /Interstellar/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Votre espace Collection locale" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter" }).click();
  expect((await download).suggestedFilename()).toBe("vela-collection.json");
});
test("la configuration refuse une clé Supabase privée", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const dialog = page.getByRole("region", { name: "Réglages", exact: true });
  await dialog
    .getByRole("textbox", { name: "URL du projet" })
    .fill("https://luma.supabase.co");
  await dialog
    .getByRole("textbox", { name: /Clé publique/ })
    .fill("sb_secret_example");
  await dialog
    .getByRole("button", { name: "Enregistrer et recharger" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("clé publique");
});

test("Material mobile: recherche uniquement dans Explorer et navigation fixe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".search-shortcut")).toHaveCount(0);
  await expect(page.locator("svg.svg-filters")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toBeVisible();
  const bounds = await nav.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.width).toBe(390);
  expect((bounds?.y || 0) + (bounds?.height || 0)).toBe(844);
  await nav.getByRole("button", { name: "Explorer", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Rechercher dans le catalogue" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Profil", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "tests/material-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const dialog = page.getByRole("region", { name: "Réglages", exact: true });
  await expect(
    dialog.getByRole("group", { name: "Thème de l’application" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Clair", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#F6FCFF",
  );
  await dialog.getByRole("button", { name: "Retour", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  await page.screenshot({ path: "tests/material-light.png", fullPage: true });
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await page.getByRole("button", { name: "Système", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Supabase: table absente, guide de réparation puis synchronisation réussie", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.addInitScript(() =>
    localStorage.setItem(
      "luma-cloud",
      JSON.stringify({
        url: "https://luma-test.supabase.co",
        key: "sb_publishable_test",
      }),
    ),
  );
  await page.route("https://luma-test.supabase.co/auth/v1/**", (r) =>
    r.fulfill({
      json: r.request().url().includes("/token")
        ? {
            access_token: jwt,
            refresh_token: "fake-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user,
          }
        : user,
    }),
  );
  let repaired = false;
  let saved: any[] = [];
  await page.route(
    "https://luma-test.supabase.co/rest/v1/library*",
    async (r) => {
      if (!repaired) {
        await r.fulfill({
          status: 404,
          json: {
            code: "PGRST205",
            message:
              "Could not find the table 'public.library' in the schema cache",
          },
        });
        return;
      }
      if (r.request().method() === "GET")
        await r.fulfill({ json: saved.map((entry) => ({ entry })) });
      else {
        saved = (
          r.request().postDataJSON() instanceof Array
            ? r.request().postDataJSON()
            : [r.request().postDataJSON()]
        ).map((x: any) => x.entry);
        await r.fulfill({ status: 201, json: [] });
      }
    },
  );
  await page.goto("/");
  await page.locator(".sidebar .account").click();
  const auth = page.getByRole("dialog");
  await auth.getByLabel("E-mail", { exact: true }).fill("test@example.com");
  await auth.getByLabel("Mot de passe", { exact: true }).fill("password-test");
  await auth.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(auth).toHaveCount(0);
  await page.locator(".sidebar .account").click();
  await expect(page.getByRole("alert")).toContainText(
    "Supabase ne trouve pas la table public.library",
  );
  await expect(
    page.getByText("Vos notes et vos listes sont synchronisées.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Corriger Supabase" }).click();
  const settings = page.getByRole("region", { name: "Réglages", exact: true });
  await expect(
    settings.getByRole("textbox", { name: "Script SQL de réparation" }),
  ).toBeVisible();
  await expect(
    settings.getByRole("textbox", { name: "Script SQL de réparation" }),
  ).toHaveValue(/notify pgrst, 'reload schema'/);
  await settings.getByRole("button", { name: "Retour", exact: true }).click();
  await page
    .getByRole("button", { name: "Découvrir", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Interstellar/ }).click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "À voir", exact: true }).click();
  await detail.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.locator(".sidebar .account").click();
  await expect(page.getByRole("alert")).toBeVisible();
  repaired = true;
  await page.getByRole("button", { name: "Synchroniser", exact: true }).click();
  await expect(
    page.getByText("Vos notes et vos listes sont synchronisées.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(saved[0]?.title.name).toBe("Interstellar");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("fiches film et série : surfaces, boutons et halo issus de l’affiche dans les deux thèmes", async ({
  page,
}) => {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({
      json: {
        results: [{ ...movie, artworkUrl100: "https://example.com/movie.svg" }],
      },
    }),
  );
  await page.route("https://example.com/*.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="${r.request().url().includes("movie") ? "#e9b91c" : "#c33b65"}"/></svg>`,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [name, tone, channel] of [
    ["Interstellar", "233 185 28", 2],
    ["Severance", "195 59 101", 1],
  ] as const) {
    for (const light of [false, true]) {
      if (
        (await page.locator("html").getAttribute("data-theme")) !==
        (light ? "light" : "dark")
      ) {
        await page
          .getByRole("button", {
            name: light ? "Passer en mode clair" : "Passer en mode sombre",
            exact: true,
          })
          .click();
      }
      await page.getByRole("button", { name: new RegExp(name) }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".details-overlay")
            .evaluate((el) => el.style.getPropertyValue("--art-rgb")),
        )
        .toBe(tone);
      await dialog
        .getByRole("button", { name: "Écrire un avis", exact: true })
        .click();
      const shadow = await dialog.evaluate(
        (el) => getComputedStyle(el).boxShadow,
      );
      expect(shadow).toContain("0px 0px 36px 12px");
      await expect
        .poll(() =>
          dialog
            .getByRole("button", { name: "Enregistrer mon avis" })
            .evaluate((el, channel) => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 1;
              const ctx = canvas.getContext("2d")!;
              ctx.fillStyle = getComputedStyle(el).backgroundColor;
              ctx.fillRect(0, 0, 1, 1);
              const rgb = ctx.getImageData(0, 0, 1, 1).data;
              return rgb[0] - rgb[channel];
            }, channel),
        )
        .toBeGreaterThan(light ? 15 : 30);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await dialog
        .getByRole("button", { name: "Annuler", exact: true })
        .click();
      await page.screenshot({
        path: `tests/detail-${name}-${light ? "light" : "dark"}.png`,
      });
      await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    }
  }
});

test("les paramètres sont une page avec URL, défilement et retour navigateur/Android, sans dialogue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const settings = page.getByRole("region", { name: "Réglages", exact: true });
  await expect(
    settings.getByRole("heading", { name: "Réglages", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#settings$/);
  const about = settings.getByRole("contentinfo", {
    name: "À propos de Vela",
  });
  await expect(
    about.getByText("A CAX Corporation company", { exact: true }),
  ).toHaveCount(1);
  await about.scrollIntoViewIfNeeded();
  await expect(
    about.getByAltText("CAX Corporation", { exact: true }),
  ).toBeVisible();
  expect(
    await about
      .getByAltText("CAX Corporation")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.screenshot({ path: "tests/branding-dark.png" });
  await page
    .getByRole("button", { name: "Passer en mode clair", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await about.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "tests/branding-light.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await settings
    .getByRole("heading", { name: "Réglages", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await settings
    .getByRole("heading", { name: /Connecter Supabase/ })
    .scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.goBack();
  await expect(settings).toHaveCount(0);
  await expect(page.getByText("Le premier rôle, c’est vous.")).toBeVisible();
  await expect(
    page.getByText("A CAX Corporation company", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  expect(await page.evaluate(() => (window as any).lumaHandleBack())).toBe(
    true,
  );
  await expect(settings).toHaveCount(0);
  await expect(page.getByText("Le premier rôle, c’est vous.")).toBeVisible();
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await page.reload();
  await expect(
    settings.getByRole("heading", { name: "Réglages", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "tests/settings-page.png" });
});

test("réglages Android : horaire quotidien, sans tests ni options Xiaomi, alarme précise conservée", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("vela-welcome-v1", "done");
    w.CapacitorCustomPlatform = { name: "android" };
    w.nativeNotificationCalls = [];
    const state: any = {
      config: {
        enabled: false,
        hour: 19,
        minute: 0,
        days: [0, 1, 2, 3, 4, 5, 6],
      },
      granted: true,
      exactAllowed: false,
      xiaomi: true,
      alarmMethod: "",
      batterySaver: true,
      reserveCount: 1,
      nextAt: 0,
      testAt: 0,
      lastSentAt: 0,
      backgroundRestricted: true,
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
        { name: "Clipboard", methods: [{ name: "write", rtype: "promise" }] },
        {
          name: "DailyRecommendations",
          methods: [
            "getState",
            "requestNotificationPermission",
            "configure",
            "updateContext",
            "openSettings",
            "openExactAlarmSettings",
            "openBackgroundSettings",
            "openAutoStartSettings",
            "testNotification",
          ].map((name) => ({ name, rtype: "promise" })),
        },
      ],
      nativePromise: async (plugin: string, method: string, options: any) => {
        if (plugin === "Clipboard") {
          w.copiedDiagnostic = options.string;
          return {};
        }
        if (plugin !== "DailyRecommendations") return {};
        w.nativeNotificationCalls.push({ method, options });
        if (method === "requestNotificationPermission")
          return { granted: true };
        if (method === "configure") {
          state.config = options.config;
          state.nextAt = Date.now() + 3600000;
          state.alarmMethod = options.config.reliableAlarm
            ? "alarm_clock"
            : "exact";
          state.reserveCount = options.config.candidates.length;
        }
        if (method === "openExactAlarmSettings") {
          state.exactAllowed = true;
          return {};
        }
        if (method === "testNotification") {
          if (options.immediate) {
            state.testAt = 0;
            state.lastStatus = "posted";
            state.lastAttemptAt = Date.now();
            state.lastSource = "immediate";
            state.lastAttemptTest = true;
            state.notificationActive = true;
          } else {
            state.testAt = Date.now() + 60000;
            state.testAlarmMethod = options.context.reliableAlarm
              ? "alarm_clock"
              : "exact";
          }
        }
        if (method === "updateContext") {
          state.config = { ...state.config, ...options.context };
        }
        return JSON.parse(JSON.stringify(state));
      },
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const settings = page.getByRole("region", { name: "Réglages", exact: true });
  await expect(
    settings.getByText("Sur Xiaomi / HyperOS", { exact: true }),
  ).toHaveCount(0);
  await expect(
    settings.getByRole("button", { name: "Tester maintenant", exact: true }),
  ).toHaveCount(0);
  await expect(
    settings.getByRole("button", { name: "Tester dans 1 minute", exact: true }),
  ).toHaveCount(0);
  await expect(
    settings.getByRole("checkbox", { name: /Fiabilité renforcée/ }),
  ).toHaveCount(0);
  await settings
    .getByRole("button", { name: /Autoriser les horaires précis/ })
    .click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await settings
    .getByRole("checkbox", { name: "Recevoir une recommandation", exact: true })
    .check();
  await settings.getByLabel("Heure de la recommandation").fill("23:59");
  await settings
    .getByRole("button", { name: "Enregistrer l’horaire", exact: true })
    .click();
  await expect(
    settings.getByText("Horaire enregistré.", { exact: true }),
  ).toBeVisible();
  const calls = await page.evaluate(
    () => (window as any).nativeNotificationCalls,
  );
  const saved = calls.find(
    (call: any) => call.method === "configure" && call.options.config.enabled,
  ).options.config;
  expect(saved.hour).toBe(23);
  expect(saved.minute).toBe(59);
  expect(saved.reliableAlarm).toBe(false);
  expect(
    calls.some(
      (call: any) =>
        call.method === "testNotification" ||
        call.method === "openAutoStartSettings",
    ),
  ).toBe(false);
  expect(
    calls.some((call: any) => call.method === "openExactAlarmSettings"),
  ).toBe(true);
  await page.screenshot({ path: "tests/settings-notifications-android.png" });
});

test("l’accueil change de titre mis en avant et réordonne ses rayons après un like", async ({
  page,
}) => {
  const gravity = {
    ...movie,
    trackId: 4,
    trackName: "Gravity",
    releaseDate: "2013-10-01",
  };
  const drama = {
    ...movie,
    trackId: 5,
    trackName: "Un autre drame",
    primaryGenreName: "Drama",
  };
  const scienceSeries = {
    ...show,
    id: 3,
    name: "Counterpart",
    genres: ["Science-Fiction"],
    rating: { average: 7.8 },
  };
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [drama, movie, gravity] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) =>
    r.fulfill({ json: [show, scienceSeries] }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".hero h2")).toHaveText("Severance");
  await page.getByRole("button", { name: /Interstellar/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Coup de cœur" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await expect(page.locator(".hero h2")).toHaveText("Gravity");
  await expect(page.locator(".hero-kicker")).toHaveText("Selon vos goûts");
  await expect(
    page.locator(".shelf").nth(0).locator(".poster-card").first(),
  ).toContainText("Gravity");
  await expect(
    page.locator(".shelf").nth(1).locator(".poster-card").first(),
  ).toContainText("Counterpart");
  expect(page.workers()).toHaveLength(0);
  await page.screenshot({ path: "tests/home-personalized.png" });
});

import { test, expect, type Page } from "./fixtures";
import { defaultProfile, makeProfile, profileKey } from "../src/profile";
import { empty, type Library } from "../src/store";
const id = "22222222-2222-4222-8222-222222222222",
  project = "https://vela-profile-test.supabase.co";
const titles = Array.from({ length: 6 }, (_, i) => ({
  id: `movie-${i + 1}`,
  kind: "movie" as const,
  source: "itunes" as const,
  name: `Film ${i + 1}`,
  year: "2024",
  image: "https://example.com/poster.svg",
  summary: "Une aventure au cinéma.",
  genres: ["Aventure"],
}));
const initial = Object.fromEntries(
  titles.map((title, i) => [
    title.id,
    {
      ...empty(title),
      watched: i < 3,
      rating: i === 0 ? 4 : i === 1 ? 5 : 0,
      favorite: i < 2,
      review: i < 2 ? `Un avis personnel sur ${title.name}.` : "",
      watchedAt: "2026-11-05",
      updated: "2026-11-05T12:00:00Z",
    },
  ]),
) as Library;
async function setup(page: Page, signed = false) {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "private@example.com",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-11-01T00:00:00Z",
  };
  let metadata: any = {},
    puts = 0,
    libraryWrites = 0;
  const payloads: any[] = [];
  const storageCalls: string[] = [];
  const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
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
    ({ signed, project, user, jwt, expiry, initial }) => {
      const key = signed ? "luma-library-v1-" + user.id : "luma-library-v1";
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(initial));
      if (signed) {
        localStorage.setItem(
          "luma-cloud",
          JSON.stringify({ url: project, key: "sb_publishable_test" }),
        );
        if (!localStorage.getItem("sb-vela-profile-test-auth-token"))
          localStorage.setItem(
            "sb-vela-profile-test-auth-token",
            JSON.stringify({
              access_token: jwt,
              refresh_token: "fake-refresh",
              expires_at: expiry,
              expires_in: 365 * 86400,
              token_type: "bearer",
              user,
            }),
          );
      }
    },
    { signed, project, user, jwt, expiry, initial },
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({
      json: {
        results: titles.map((t, i) => ({
          trackId: i + 1,
          trackName: t.name,
          releaseDate: "2024-01-01",
          artworkUrl100: t.image,
          longDescription: t.summary,
          primaryGenreName: "Adventure",
        })),
      },
    }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.route("https://example.com/poster.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#165371"/><circle cx="100" cy="120" r="50" fill="#7BD0FF"/></svg>',
    }),
  );
  await page.route(project + "/auth/v1/**", async (r) => {
    if (r.request().method() === "PUT") {
      puts++;
      const payload = r.request().postDataJSON();
      payloads.push(payload);
      metadata = { ...metadata, ...payload.data };
    }
    await r.fulfill({
      json: r.request().url().includes("/token")
        ? {
            access_token: jwt,
            refresh_token: "fake-refresh",
            expires_at: expiry,
            expires_in: 365 * 86400,
            token_type: "bearer",
            user: { ...user, user_metadata: metadata },
          }
        : { ...user, user_metadata: metadata },
    });
  });
  await page.route(project + "/rest/v1/library*", (r) => {
    if (r.request().method() !== "GET") {
      libraryWrites++;
      return r.fulfill({ status: 201, json: [] });
    }
    return r.fulfill({
      json: Object.values(initial).map((entry) => ({ entry })),
    });
  });
  await page.route(project + "/storage/**", (r) => {
    storageCalls.push(r.request().url());
    return r.abort();
  });
  await page.goto("/");
  if (signed)
    await expect(page.locator(".sidebar .account")).toContainText("Mon espace");
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  return {
    puts: () => puts,
    payloads,
    metadata: () => metadata,
    storageCalls,
    libraryWrites: () => libraryWrites,
  };
}
async function edit(page: Page) {
  await page
    .getByRole("button", { name: "Modifier mon profil", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Modifier mon profil",
    exact: true,
  });
  await expect(editor).toBeVisible();
  return editor;
}
test("profil local : nom, avatars embarqués et fonds, quatre favoris ordonnés, stats et persistance sans import de photo", async ({
  page,
}) => {
  await setup(page);
  const editor = await edit(page);
  await expect(page).toHaveURL(/#profile\/edit$/);
  await expect(editor.locator('input[type="file"]')).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.getByLabel("Nom affiché", { exact: true }).fill("Nora");
  await editor
    .getByLabel("Quelques mots sur vous")
    .fill("Les aventures et les grands écrans.");
  await editor
    .getByRole("button", { name: "Chat de cinéma", exact: true })
    .click();
  await editor.getByRole("button", { name: "Lavande", exact: true }).click();
  await expect(
    editor.locator(".profile-edit-preview .avatar-art"),
  ).toBeVisible();
  await expect(
    editor.locator(".profile-edit-preview svg.avatar-art"),
  ).toHaveCount(1);
  await expect(editor.locator(".avatar-choices img")).toHaveCount(0);
  await expect(editor.locator(".avatar-choices > button")).toHaveCount(29);
  for (let i = 1; i <= 4; i++)
    await editor
      .locator(".featured-choices")
      .getByRole("button", { name: `Film ${i} 2024`, exact: true })
      .click();
  await editor
    .locator(".featured-choices")
    .getByRole("button", { name: "Film 5 2024", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("quatre titres");
  await editor
    .getByRole("button", {
      name: "Déplacer Film 4 vers la gauche",
      exact: true,
    })
    .click();
  await editor
    .getByRole("button", { name: "Enregistrer mon profil", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nora", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("luma-library-v1") || "{}"),
        ).filter((e: any) => e.favorite).length,
    ),
  ).toBe(2);
  await expect(
    page
      .getByRole("region", { name: "Les incontournables du profil" })
      .getByRole("button", { name: /^Ouvrir/ }),
  ).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Activité du profil" }),
  ).toContainText("3 films et 0 séries vus");
  await page.screenshot({ path: "tests/profile-dark.png", fullPage: true });
  await page
    .getByRole("button", { name: "Passer en mode clair", exact: true })
    .click();
  await page.screenshot({ path: "tests/profile-light.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nora", exact: true }),
  ).toBeVisible();
  const restored = await edit(page);
  await expect(
    restored.getByRole("button", { name: "Chat de cinéma", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    restored.getByRole("button", { name: "Lavande", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as any).lumaHandleBack())).toBe(
    true,
  );
  await expect(restored).toHaveCount(0);
});
test("compte Supabase : sauvegarde légère sans Storage et restauration depuis les métadonnées après effacement du cache local", async ({
  page,
}) => {
  const x = await setup(page, true);
  const editor = await edit(page);
  await editor.getByLabel("Nom affiché", { exact: true }).fill("Lyra");
  await editor.getByRole("button", { name: "Incognito", exact: true }).click();
  await editor
    .getByRole("button", { name: "Couleur du thème", exact: true })
    .click();
  const preview = editor.locator(".profile-edit-preview .preset-avatar");
  const before = await preview.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--brand", "#eabed3"),
  );
  await expect(preview).toHaveCSS("background-color", "rgb(234, 190, 211)");
  expect(before).not.toBe("rgb(234, 190, 211)");
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("--brand"),
  );
  await editor
    .locator(".featured-choices")
    .getByRole("button", { name: "Film 1 2024", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Enregistrer mon profil", exact: true })
    .click();
  await expect(
    page.getByText("Profil enregistré et synchronisé avec Supabase.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(x.puts()).toBe(1);
  expect(x.storageCalls).toEqual([]);
  expect(JSON.stringify(x.payloads[0]).length).toBeLessThan(3000);
  expect(x.metadata().vela_profile).toMatchObject({
    displayName: "Lyra",
    avatar: "cool",
    background: "theme",
  });
  expect(JSON.stringify(x.payloads)).not.toContain("base64");
  await edit(page);
  await page.evaluate(
    (key) => localStorage.removeItem(key),
    profileKey(project, id),
  );
  await page.reload();
  const restored = page.getByRole("region", {
    name: "Modifier mon profil",
    exact: true,
  });
  await expect(restored.getByLabel("Nom affiché", { exact: true })).toHaveValue(
    "Lyra",
  );
  await expect(
    restored.getByRole("button", { name: "Incognito", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(x.puts()).toBe(1);
});
test("profil hors connexion : changements conservés puis synchronisés par le bouton de sauvegarde existant", async ({
  page,
  context,
}) => {
  const x = await setup(page, true);
  await expect(
    page.getByText("Vos notes et vos listes sont synchronisées.", {
      exact: true,
    }),
  ).toBeVisible();
  await context.setOffline(true);
  const editor = await edit(page);
  await editor.getByLabel("Nom affiché", { exact: true }).fill("Hors ligne");
  await editor
    .getByRole("button", { name: "Fantôme cinéphile", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Enregistrer mon profil", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hors ligne", exact: true }),
  ).toBeVisible();
  expect(x.puts()).toBe(0);
  await expect(
    page.getByText(/changements du profil.*attendent leur synchronisation/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Vos changements sont enregistrés.*attendent la prochaine sauvegarde Supabase/,
    ),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Synchroniser", exact: true }).click();
  await expect.poll(x.puts).toBe(1);
  await expect(
    page.getByText(/changements du profil.*attendent leur synchronisation/),
  ).toHaveCount(0);
  expect(x.metadata().vela_profile.avatar).toBe("ghost");
});
test("partage web : vrais liens publics profil et avis, sans image ni données privées, consultables sans compte", async ({
  page,
  browser,
}) => {
  const records = new Map<string, any>();
  const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    reviewId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const routeShares = async (target: Page) =>
    target.route(project + "/rest/v1/vela_shares*", async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (req.method() === "POST") {
        const input = req.postDataJSON();
        const key = input.kind === "profile" ? profileId : reviewId;
        const row = {
          id: key,
          kind: input.kind,
          payload: input.payload,
          updated_at: input.updated_at,
        };
        records.set(key, row);
        return route.fulfill({ status: 201, json: row });
      }
      const wanted = u.searchParams.get("id")?.replace(/^eq\./, "");
      if (req.method() === "DELETE") {
        if (wanted) records.delete(wanted);
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: wanted
          ? [records.get(wanted)].filter(Boolean)
          : [...records.values()],
      });
    });
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify({ profile: value, synced: "" }));
      (window as any).shares = [];
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: any) => {
          (window as any).shares.push(data);
        },
      });
    },
    {
      key: profileKey(project, id),
      value: makeProfile(
        {
          ...defaultProfile,
          displayName: "Nora",
          avatar: "cat",
          featured: [titles[0]],
        },
        defaultProfile,
      ),
    },
  );
  await routeShares(page);
  await setup(page, true);
  await page
    .getByRole("button", { name: "Partager mon profil", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Partager un lien public",
    exact: true,
  });
  await expect(dialog.getByLabel("Lien public", { exact: true })).toHaveValue(
    new RegExp("#/s/" + profileId + "$"),
  );
  await dialog
    .getByRole("button", { name: "Partager le lien", exact: true })
    .click();
  let shared = await page.evaluate(() => (window as any).shares[0]);
  expect(shared.url).toContain("#/s/" + profileId);
  expect(shared.files).toBeUndefined();
  expect(JSON.stringify(records.get(profileId))).not.toContain(
    "private@example.com",
  );
  expect(JSON.stringify(records.get(profileId))).not.toContain(
    "Un avis personnel",
  );
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page
    .getByRole("region", { name: "Mes avis", exact: true })
    .getByRole("button", { name: "Partager cet avis", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog", {
    name: "Partager un lien public",
    exact: true,
  });
  await expect(dialog.getByLabel("Lien public", { exact: true })).toHaveValue(
    new RegExp("#/s/" + reviewId + "$"),
  );
  await dialog
    .getByRole("button", { name: "Partager le lien", exact: true })
    .click();
  shared = await page.evaluate(() => (window as any).shares[1]);
  expect(shared.files).toBeUndefined();
  expect(shared.url).toContain("#/s/" + reviewId);
  expect(records.get(reviewId).payload.review.text).toContain(
    "Un avis personnel",
  );
  expect(records.get(reviewId).payload.review.rating).toBe(4);
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    guest = await context.newPage();
  await guest.addInitScript(
    (project) =>
      localStorage.setItem(
        "luma-cloud",
        JSON.stringify({ url: project, key: "sb_publishable_test" }),
      ),
    project,
  );
  await routeShares(guest);
  await guest.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await guest.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await guest.goto("http://127.0.0.1:5173/#/s/" + profileId);
  await expect(
    guest.getByRole("region", { name: "Profil public", exact: true }),
  ).toContainText("Nora");
  await expect(
    guest.getByRole("button", { name: "Modifier mon profil", exact: true }),
  ).toHaveCount(0);
  await expect(
    guest.getByText("private@example.com", { exact: true }),
  ).toHaveCount(0);
  await expect(guest.getByRole("dialog")).toHaveCount(0);
  await guest.goto("http://127.0.0.1:5173/#/s/" + reviewId);
  await expect(
    guest.getByRole("region", { name: "Avis public", exact: true }),
  ).toContainText("Un avis personnel sur Film 1.");
  await expect(
    guest.getByRole("region", { name: "Avis public", exact: true }),
  ).toContainText("4/5");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const settings = page.getByRole("region", {
    name: "Liens publics",
    exact: true,
  });
  await settings
    .getByRole("button", { name: "Gérer mes liens publics", exact: true })
    .click();
  await settings
    .locator(".published-share")
    .filter({ hasText: "Mon profil" })
    .getByRole("button", { name: "Retirer ce lien", exact: true })
    .click();
  await guest.goto("http://127.0.0.1:5173/#/s/" + profileId);
  await expect(guest.getByRole("alert")).toContainText("plus disponible");
  await context.close();
});

test("partage Android : lien de fiche immédiat sans image ni écriture de fichier, annulation sans copie", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("vela-welcome-v1", "done");
    w.CapacitorCustomPlatform = { name: "android" };
    w.nativeShares = [];
    w.nativeWrites = [];
    w.nativeCopies = [];
    w.Capacitor = {
      PluginHeaders: [
        {
          name: "LumaAppearance",
          methods: [{ name: "setTheme", rtype: "promise" }],
        },
        {
          name: "SystemBars",
          methods: [{ name: "setStyle", rtype: "promise" }],
        },
        { name: "Share", methods: [{ name: "share", rtype: "promise" }] },
        {
          name: "Filesystem",
          methods: [{ name: "writeFile", rtype: "promise" }],
        },
        { name: "Clipboard", methods: [{ name: "write", rtype: "promise" }] },
      ],
      nativePromise: async (plugin: string, method: string, options: any) => {
        if (plugin === "Filesystem") w.nativeWrites.push(options);
        if (plugin === "Share") {
          w.nativeShares.push(options);
          if (w.cancelShare) throw new Error("Share canceled");
        }
        if (plugin === "Clipboard") w.nativeCopies.push(options);
        return {};
      },
    };
  });
  await setup(page);
  await page
    .getByRole("region", { name: "Mes avis", exact: true })
    .getByRole("button", { name: "Film 1 2024", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Partager cette fiche film", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nativeShares.length))
    .toBe(1);
  const shared = await page.evaluate(() => (window as any).nativeShares[0]);
  expect(shared.url).toBe("https://vela.thomasbarial.com/#/title/movie-1");
  expect(shared.files).toBeUndefined();
  expect(await page.evaluate(() => (window as any).nativeWrites.length)).toBe(
    0,
  );
  await page.evaluate(() => {
    (window as any).cancelShare = true;
  });
  await dialog
    .getByRole("button", { name: "Partager cette fiche film", exact: true })
    .click();
  await expect(
    page.getByText("Partage annulé.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).nativeCopies.length)).toBe(
    0,
  );
  await dialog
    .getByRole("button", { name: "Partager mon avis", exact: true })
    .click();
  const nested = page.getByRole("dialog", {
    name: "Partager un lien public",
    exact: true,
  });
  await expect(nested).toBeVisible();
  await nested.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

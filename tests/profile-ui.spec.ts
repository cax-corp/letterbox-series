import { test, expect, type Page } from "@playwright/test";
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
  expect(
    await editor
      .locator(".profile-edit-preview img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
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
  await editor.getByRole("button", { name: "Astronaute", exact: true }).click();
  await editor.getByRole("button", { name: "Abricot", exact: true }).click();
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
    avatar: "astronaut",
    background: "amber",
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
    restored.getByRole("button", { name: "Astronaute", exact: true }),
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
test("partage web : cartes PNG du profil et des avis, sans e-mail ni avis privés ajoutés au profil partagé", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify({ profile: value, synced: "" }));
      (window as any).shares = [];
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: any) => {
          const bitmap = data.files?.[0]
            ? await createImageBitmap(data.files[0])
            : null;
          (window as any).shares.push({
            title: data.title,
            text: data.text,
            file: data.files?.[0]
              ? {
                  type: data.files[0].type,
                  size: data.files[0].size,
                  width: bitmap?.width,
                  height: bitmap?.height,
                }
              : null,
          });
          bitmap?.close();
        },
      });
    },
    {
      key: profileKey("", "local"),
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
  await setup(page);
  await page
    .getByRole("button", { name: "Partager mon profil", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).shares.length))
    .toBe(1);
  let shared = await page.evaluate(() => (window as any).shares[0]);
  expect(shared.file).toMatchObject({
    type: "image/png",
    width: 1080,
    height: 1350,
  });
  expect(shared.file.size).toBeGreaterThan(20000);
  expect(shared.text).toContain("Nora");
  expect(shared.text).not.toContain("@");
  expect(shared.text).not.toContain("Un avis personnel");
  await page
    .getByRole("region", { name: "Mes avis", exact: true })
    .getByRole("button", { name: "Partager cet avis", exact: true })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).shares.length))
    .toBe(2);
  shared = await page.evaluate(() => (window as any).shares[1]);
  expect(shared.text).toContain("Un avis personnel");
  expect(shared.text).toContain("4/5");
  expect(shared.text).not.toContain("@");
  await page
    .getByRole("region", { name: "Mes avis", exact: true })
    .getByRole("button", { name: "Film 1 2024", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Partager mon avis", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByLabel("Votre critique")
    .fill("Un texte pas encore enregistré");
  await expect(
    dialog.getByRole("button", { name: "Partager mon avis", exact: true }),
  ).toBeDisabled();
});
test("partage Android : image locale en cache via Filesystem et Share, annulation sans copie surprise", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
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
        if (plugin === "Filesystem") {
          w.nativeWrites.push(options);
          return {
            uri: "content://app.luma.cinema.fileprovider/cache/vela-partage-profile.png",
          };
        }
        if (plugin === "Share") {
          w.nativeShares.push(options);
          if (w.cancelShare) throw new Error("Share canceled");
          return {};
        }
        if (plugin === "Clipboard") {
          w.nativeCopies.push(options);
          return {};
        }
        return {};
      },
    };
  });
  await setup(page);
  await page
    .getByRole("button", { name: "Partager mon profil", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).nativeShares.length))
    .toBe(1);
  const result = await page.evaluate(() => ({
    share: (window as any).nativeShares[0],
    write: (window as any).nativeWrites[0],
  }));
  expect(result.share.files).toEqual([
    "content://app.luma.cinema.fileprovider/cache/vela-partage-profile.png",
  ]);
  expect(result.write.directory).toBe("CACHE");
  expect(result.write.data.startsWith("iVBOR")).toBe(true);
  await page.evaluate(() => {
    (window as any).cancelShare = true;
  });
  await page
    .getByRole("button", { name: "Partager mon profil", exact: true })
    .click();
  await expect(
    page.getByText("Partage annulé.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).nativeCopies.length)).toBe(
    0,
  );
});

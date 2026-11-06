import { test, expect, type Page } from "@playwright/test";
async function catalogue(page: Page) {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({
      json: {
        results: Array.from({ length: 12 }, (_, i) => ({
          trackId: i + 1,
          trackName: `Film web ${i + 1}`,
          releaseDate: "2024-01-01",
          artworkUrl100: "",
          longDescription: "Une aventure sur grand écran.",
          primaryGenreName: "Adventure",
        })),
      },
    }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
}
test("web : barre du haut bord à bord et décoration simplifiée sur PC et mobile", async ({
  page,
}) => {
  await catalogue(page);
  await page.goto("/");
  await expect(page.locator(".sidebar-note, .orbit-mark")).toHaveCount(0);
  await expect(
    page.getByText("Gardez-en une trace.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".breadcrumb, .nav-caption")).toHaveCount(0);
  for (const width of [1916, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 932 });
    const header = (await page.locator(".topbar").boundingBox())!;
    const left =
      width > 760 ? (await page.locator(".sidebar").boundingBox())!.width : 0;
    expect(Math.abs(header.x - left)).toBeLessThan(1);
    expect(Math.abs(header.x + header.width - width)).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("web : Pour vous présente son indisponibilité et un vrai téléchargement Android sans charger le feed", async ({
  page,
}) => {
  await catalogue(page);
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 932 });
    const nav = page.locator(width > 760 ? ".sidebar" : ".mobile-nav");
    await nav.getByRole("button", { name: "Pour vous", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Pour vous", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/en cours de développement sur le web/),
    ).toBeVisible();
    await expect(page.getByRole("feed")).toHaveCount(0);
    await expect(page.locator("main")).not.toHaveClass("is-feed");
    await expect(page.locator(".feed-ambience")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({ path: "tests/web-desktop-for-you.png" });
    else await page.screenshot({ path: "tests/web-mobile-for-you.png" });
    await page
      .getByRole("button", { name: "Explorer le catalogue", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Rechercher dans le catalogue" }),
    ).toBeVisible();
  }
  expect(workers).toEqual([]);
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Pour vous", exact: true })
    .click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Télécharger pour Android", exact: true })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("Vela-2.2.1.apk");
  expect(await download.failure()).toBeNull();
  const { readFile } = await import("node:fs/promises");
  const apk = await readFile((await download.path())!);
  expect(apk.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(apk.length).toBeGreaterThan(1_000_000);
});

test("web adaptatif : profil et réglages lisibles en PC, tablette et téléphone, sans commande Android fictive", async ({
  page,
}) => {
  await catalogue(page);
  await page.goto("/");
  for (const width of [1920, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const mobile = width <= 760;
    if (mobile)
      await page
        .locator(".mobile-nav")
        .getByRole("button", { name: "Profil", exact: true })
        .click();
    else
      await page
        .locator(".sidebar")
        .getByRole("button", { name: "Votre espace Collection locale" })
        .click();
    const profile = page.locator(".page-section.profile");
    await expect(profile).toBeVisible();
    expect((await profile.boundingBox())!.width).toBeLessThanOrEqual(1120);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1920)
      await page.screenshot({ path: "tests/web-desktop-profile.png" });
    await page
      .getByRole("button", { name: "Réglages", exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByText(/Le site suit ce thème sur votre navigateur/),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Les notifications programmées sont disponibles dans l’APK Android/,
      ),
    ).toBeAttached();
    await expect(
      page.getByRole("button", { name: "Tester dans 1 minute", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Retour", exact: true }).click();
  }
});
test("web : les e-mails de confirmation reviennent vers la base du site, sans modifier les liens de partage", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "luma-cloud",
      JSON.stringify({
        url: "https://vela-web-test.supabase.co",
        key: "sb_publishable_test",
      }),
    ),
  );
  await catalogue(page);
  let redirect = "";
  await page.route(
    "https://vela-web-test.supabase.co/auth/v1/signup*",
    async (r) => {
      redirect =
        new URL(r.request().url()).searchParams.get("redirect_to") || "";
      await r.fulfill({
        json: {
          user: {
            id: "33333333-3333-4333-8333-333333333333",
            email: "web@example.com",
            user_metadata: {},
          },
          session: null,
        },
      });
    },
  );
  await page.goto("/");
  await page.locator(".sidebar").locator(".account").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Créer un compte/ }).click();
  await dialog.getByLabel("E-mail", { exact: true }).fill("web@example.com");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await dialog.getByRole("button", { name: /Créer mon compte/ }).click();
  await expect.poll(() => redirect).toBe("http://127.0.0.1:5173/");
});

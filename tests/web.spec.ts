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
test("web sur PC : navigation latérale, grille et fil utilisable au clavier dès l’ouverture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await catalogue(page);
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".mobile-nav")).toBeHidden();
  expect(
    await page
      .locator(".poster-grid")
      .first()
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
  ).toBeGreaterThanOrEqual(4);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Pour vous", exact: true })
    .click();
  const feed = page.getByRole("feed");
  await expect(feed).toHaveAttribute("aria-busy", "false");
  await expect(feed).toBeFocused();
  const old = await page.locator(".feed-ambience").getAttribute("data-title");
  await page.keyboard.press("PageDown");
  await expect(page.locator(".feed-ambience")).not.toHaveAttribute(
    "data-title",
    old!,
  );
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-moving",
    "false",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tests/web-desktop-feed.png" });
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
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Votre espace Collection locale" })
    .click();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Créer un compte/ }).click();
  await dialog.getByLabel("E-mail", { exact: true }).fill("web@example.com");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("mot-de-passe-test");
  await dialog.getByRole("button", { name: /Créer mon compte/ }).click();
  await expect.poll(() => redirect).toBe("http://127.0.0.1:5173/");
});

import { test, expect, type Page } from "./fixtures";
import { empty } from "../src/store";
import { defaultProfile, makeProfile, profileKey } from "../src/profile";
import { wrapStoryText } from "../src/story-image";
import { readFile } from "node:fs/promises";

const title = {
  id: "movie-1",
  kind: "movie" as const,
  source: "itunes" as const,
  name: "Interstellar",
  year: "2014",
  genres: ["Science-fiction"],
  summary: "Un voyage dans les étoiles.",
  image: "https://example.com/story-poster.svg",
};
const review = "Un voyage magnifique, à revoir. ".repeat(45);
const entry = {
  ...empty(title),
  rating: 4.5,
  favorite: true,
  review,
  watched: true,
};
const profile = makeProfile(
  {
    ...defaultProfile,
    displayName: "Nora",
    avatar: "wink",
    background: "coral",
  },
  defaultProfile,
);
async function setup(
  page: Page,
  options: {
    native?: boolean;
    missing?: boolean;
    english?: boolean;
    rating?: number;
  } = {},
) {
  const calls: string[] = [];
  await page.addInitScript(
    ({ entry, profile, key, options }) => {
      localStorage.setItem("vela-welcome-v1", "done");
      localStorage.setItem(
        "luma-library-v1",
        JSON.stringify({
          [entry.title.id]: {
            ...entry,
            rating: options.rating ?? entry.rating,
          },
        }),
      );
      localStorage.setItem(key, JSON.stringify({ profile, synced: "" }));
      if (options.english)
        localStorage.setItem(
          "vela-language-v1:local:local",
          JSON.stringify({
            version: 1,
            code: "en-US",
            updated: new Date().toISOString(),
          }),
        );
      const w = window as any;
      w.storyShares = [];
      w.storySaves = [];
      w.linkShares = [];
      if (options.native) {
        w.CapacitorCustomPlatform = { name: "android" };
        w.Capacitor = {
          PluginHeaders: [
            {
              name: "VelaStories",
              methods: [
                { name: "share", rtype: "promise" },
                { name: "save", rtype: "promise" },
              ],
            },
            {
              name: "CapacitorHttp",
              methods: [{ name: "get", rtype: "promise" }],
            },
            { name: "Share", methods: [{ name: "share", rtype: "promise" }] },
            {
              name: "LumaAppearance",
              methods: [{ name: "setTheme", rtype: "promise" }],
            },
            {
              name: "SystemBars",
              methods: [{ name: "setStyle", rtype: "promise" }],
            },
          ],
          nativePromise: async (plugin: string, method: string, args: any) => {
            if (plugin === "CapacitorHttp") {
              const blob = await (await fetch(args.url)).blob();
              const data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve(String(reader.result).split(",")[1]);
                reader.readAsDataURL(blob);
              });
              return {
                status: 200,
                data,
                headers: { "content-type": blob.type },
              };
            }
            if (plugin === "VelaStories") {
              if (method === "share") {
                w.storyShares.push(args);
                return { destination: "instagram" };
              }
              w.storySaves.push(args);
              return { saved: true };
            }
            if (plugin === "Share") w.linkShares.push(args);
            return {};
          },
        };
      } else {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value: () => false,
        });
      }
    },
    { entry, profile, key: profileKey("", "local"), options },
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({
      json: {
        results: [
          {
            trackId: 1,
            trackName: title.name,
            releaseDate: "2014-01-01",
            artworkUrl100: title.image,
            longDescription: title.summary,
            primaryGenreName: "Science-fiction",
          },
        ],
      },
    }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.route(title.image, (r) =>
    options.missing
      ? r.abort()
      : r.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#ddba22"/><circle cx="300" cy="300" r="140" fill="#fff4c3"/><text x="300" y="650" font-size="65" text-anchor="middle">INTERSTELLAR</text></svg>',
        }),
  );
  page.on("request", (request) => {
    if (/supabase.*\/(storage|rest)\//.test(request.url()))
      calls.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /Interstellar/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: options.english ? "Share to story" : "Partager en story",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: options.english ? "Share to story" : "Partager en story",
    exact: true,
  });
  await expect(dialog.locator(".story-preview img")).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: options.english ? "Save image" : "Enregistrer le visuel",
      exact: true,
    }),
  ).toBeEnabled();
  return { dialog, calls };
}
test("PNG story 9:16, aperçu sur téléphone et PC, extrait borné et téléchargement sans upload", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog, calls } = await setup(page);
  const image = dialog.locator(".story-preview img");
  expect(
    await image.evaluate((img: HTMLImageElement) => [
      img.naturalWidth,
      img.naturalHeight,
    ]),
  ).toEqual([1080, 1920]);
  await dialog.screenshot({ path: info.outputPath("story-mobile.png") });
  const first = await image.getAttribute("src");
  await dialog
    .getByRole("button", { name: "Avec un extrait", exact: true })
    .click();
  await expect(image).not.toHaveAttribute("src", first!);
  await expect(dialog).toContainText("Un extrait est affiché.");
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Enregistrer le visuel", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Vela-Interstellar.png");
  const png = await readFile((await file.path())!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
  await file.saveAs(info.outputPath("story-review.png"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.screenshot({ path: info.outputPath("story-desktop.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(calls).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Interstellar", exact: true }),
  ).toBeVisible();
});
test("partage navigateur : fichier seul, prêt avant le clic, annulation sans téléchargement", async ({
  page,
}) => {
  const { dialog } = await setup(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { value: () => true });
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        (window as any).storyShares.push({
          keys: Object.keys(data),
          type: data.files?.[0].type,
          name: data.files?.[0].name,
        });
        throw new DOMException("cancelled", "AbortError");
      },
    });
  });
  // Changing the format also re-evaluates file sharing capability.
  await dialog
    .getByRole("button", { name: "Avec un extrait", exact: true })
    .click();
  const button = dialog.getByRole("button", {
    name: "Partager le visuel",
    exact: true,
  });
  await expect(button).toBeEnabled();
  let downloads = 0;
  page.on("download", () => downloads++);
  await button.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).storyShares.length))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).storyShares[0])).toEqual({
    keys: ["files", "title"],
    type: "image/png",
    name: "Vela-Interstellar.png",
  });
  expect(downloads).toBe(0);
  await expect(dialog).toBeVisible();
});
test("Android : export PNG via plugin Stories, partage de lien séparé et retour sur la fiche", async ({
  page,
}) => {
  const { dialog, calls } = await setup(page, { native: true });
  await dialog
    .getByRole("button", { name: "Partager sur Instagram", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).storyShares.length))
    .toBe(1);
  const args = await page.evaluate(() => (window as any).storyShares[0]);
  expect(args.target).toBe("instagram");
  expect(Buffer.from(args.png, "base64").readUInt32BE(16)).toBe(1080);
  await dialog
    .getByRole("button", { name: "Enregistrer le visuel", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).storySaves.length))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).linkShares.length)).toBe(0);
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => (window as any).lumaHandleBack())).toBe(
    true,
  );
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
});
test("affiche indisponible : repli utilisable et réessai, interface anglaise", async ({
  page,
}) => {
  const { dialog } = await setup(page, {
    missing: true,
    english: true,
    rating: 0,
  });
  await expect(dialog).toContainText("The poster could not be loaded.");
  await expect(
    dialog.getByRole("button", { name: "Save image", exact: true }),
  ).toBeEnabled();
  const old = await dialog.locator(".story-preview img").getAttribute("src");
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(dialog.locator(".story-preview img")).not.toHaveAttribute(
    "src",
    old!,
  );
});
test("accès story depuis un avis du profil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await setup(page);
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page
    .getByRole("region", { name: "Mes avis", exact: true })
    .getByRole("button", { name: "Partager en story", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Partager en story", exact: true })
      .locator(".story-preview img"),
  ).toBeVisible();
});
test("mise en lignes : titre très long, mots sans espaces et avis Unicode restent bornés", () => {
  const measureText = (value: string) =>
    ({ width: Array.from(value).length * 10 }) as TextMetrics;
  for (const text of [
    "abc ".repeat(100),
    "🚀".repeat(100),
    "Un avis 🌙 personnel très long ".repeat(100),
  ]) {
    const result = wrapStoryText({ measureText }, text, 100, 3);
    expect(result.lines.length).toBeLessThanOrEqual(3);
    expect(result.truncated).toBe(true);
    expect(result.lines.at(-1)).toMatch(/…$/);
    for (const line of result.lines)
      expect(measureText(line).width).toBeLessThanOrEqual(100);
  }
});

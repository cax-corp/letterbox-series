import { test, expect, type Page } from "./fixtures";
import {
  colourThemes,
  getColourTheme,
  colourVariables,
  colourThemeKey,
} from "../src/colour-themes";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

async function catalog(page: Page) {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
}

test("palettes complètes : contraste lisible et sélection limitée aux neuf presets", () => {
  expect(colourThemes).toHaveLength(9);
  expect(new Set(colourThemes.map((p) => p.id)).size).toBe(9);
  expect(getColourTheme("invalid").id).toBe("blue");
  expect(getColourTheme(null).id).toBe("blue");
  for (const p of colourThemes) {
    expect(contrast(p.hex, p.ink), p.id + " button").toBeGreaterThanOrEqual(
      4.5,
    );
    for (const mode of ["dark", "light"] as const) {
      const roles = p[mode];
      for (const surface of [
        roles.bg,
        roles.panel,
        roles.surface,
        roles.nav,
        roles.secondary,
      ]) {
        expect(
          contrast(roles.text, surface),
          p.id + mode + " text",
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(roles.muted, surface),
          p.id + mode + " secondary text",
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(mode === "light" ? p.link : p.hex, roles.panel),
      ).toBeGreaterThanOrEqual(4.5);
      expect(colourVariables(p, mode === "light")["--bg"]).toBe(roles.bg);
    }
  }
});

test("web : chaque palette adapte les surfaces, le logo et le favicon dans les deux modes", async ({
  page,
}) => {
  await catalog(page);
  await page.goto("/#settings");
  const settings = page.getByRole("region", { name: "Réglages", exact: true });
  await expect(settings.getByRole("radio")).toHaveCount(9);
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
  for (const mode of ["dark", "light"] as const) {
    await settings
      .getByRole("button", {
        name: mode === "dark" ? "Sombre" : "Clair",
        exact: true,
      })
      .click();
    for (const p of colourThemes) {
      await settings.getByRole("radio", { name: p.name, exact: true }).check();
      await expect(page.locator("html")).toHaveAttribute(
        "data-colour-theme",
        p.id,
      );
      await expect(page.locator("html")).toHaveCSS(
        "background-color",
        rgb(p[mode].bg),
      );
      await expect(page.locator(".sidebar .brand-dot")).toHaveCSS(
        "background-color",
        rgb(p.hex),
      );
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        p[mode].bg,
      );
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
        "href",
        `./brand/themes/${p.id}.svg`,
      );
      const icon = await page.request.get(`/brand/themes/${p.id}.svg`);
      expect(icon.ok()).toBe(true);
      expect(await icon.text()).toContain(p.hex);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--nav-surface")
            .trim(),
        ),
      ).toBe(p[mode].nav);
    }
  }
});

test("mobile : palette mémorisée, mode système indépendant et choix au clavier sans débordement", async ({
  page,
}) => {
  await catalog(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/#settings");
  const picker = page.getByRole("group", {
    name: "Palette de couleurs",
    exact: true,
  });
  await picker.getByRole("radio", { name: "Champagne", exact: true }).check();
  await page.getByRole("button", { name: "Système", exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    rgb(getColourTheme("champagne").light.bg),
  );
  await page.reload();
  await expect(
    picker.getByRole("radio", { name: "Champagne", exact: true }),
  ).toBeChecked();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    rgb(getColourTheme("champagne").dark.bg),
  );
  await picker.getByRole("radio", { name: "Champagne", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    picker.getByRole("radio", { name: "Iris grisé", exact: true }),
  ).toBeChecked();
  await picker.getByRole("radio", { name: "Champagne", exact: true }).check();
  for (const mode of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tests/themes-${mode}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const radio of await picker.getByRole("radio").all()) {
      const bounds = (await radio.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("restauration avant React : aucun flash bleu et repli sûr pour une palette inconnue", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "copper");
    localStorage.setItem("luma-theme", "light");
  }, colourThemeKey);
  await page.route("**/src/main.tsx", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator("#root")).toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "copper",
  );
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    rgb(getColourTheme("copper").light.bg),
  );
  await page.addInitScript(
    (key) => localStorage.setItem(key, "__proto__"),
    colourThemeKey,
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-colour-theme",
    "blue",
  );
});

test("Android : la palette et le contraste des barres sont transmis au pont natif", async ({
  page,
}) => {
  await catalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const w = window as any;
    w.themeCalls = [];
    localStorage.setItem("vela-welcome-v1", "done");
    w.CapacitorCustomPlatform = { name: "android" };
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
      ],
      nativePromise: async (
        plugin: string,
        method: string,
        options: unknown,
      ) => {
        w.themeCalls.push({ plugin, method, options });
        return {};
      },
    };
  });
  await page.goto("/#settings");
  await page.getByRole("radio", { name: "Rubis", exact: true }).check();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).themeCalls
            .filter((c: any) => c.plugin === "LumaAppearance")
            .at(-1)?.options,
      ),
    )
    .toEqual({ dark: true, themeId: "ruby" });
  await page.getByRole("button", { name: "Clair", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).themeCalls
            .filter((c: any) => c.plugin === "LumaAppearance")
            .at(-1)?.options,
      ),
    )
    .toEqual({ dark: false, themeId: "ruby" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).themeCalls
            .filter((c: any) => c.plugin === "SystemBars")
            .at(-1)?.options,
      ),
    )
    .toEqual({ style: "LIGHT" });
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Rubis", exact: true }),
  ).toBeChecked();
});

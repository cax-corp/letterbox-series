import { test, expect } from "./fixtures";
import {
  buildTasteMap,
  projectTastePoint,
  rotateTasteView,
  initialTasteRotation,
} from "../src/taste-map";
import { empty, type Library } from "../src/store";
import type { Title } from "../src/catalog";
const title = (
  id: number,
  name: string,
  genres: number[],
  summary: string,
): Title => ({
  id: `movie-${id}`,
  kind: "movie",
  name,
  genreIds: genres,
  genres: genres.includes(878)
    ? ["Science-fiction", "Aventure"]
    : genres.includes(27)
      ? ["Horreur"]
      : ["Comédie"],
  year: "2024",
  summary,
  image: "",
});
const seed: Library = {};
for (let i = 1; i <= 18; i++) {
  const t = title(
    i,
    `${i < 7 ? "Station" : i < 13 ? "Comédie" : "Horreur"} ${i}`,
    i < 7 ? [878, 12] : i < 13 ? [35, 18] : [27, 53],
    i < 7
      ? "Une mission spatiale explore une planète avec des astronautes."
      : i < 13
        ? "Une famille et ses amis partent pour un voyage amusant."
        : "Des survivants tentent de fuir des zombies dans une ville.",
  );
  seed[t.id] = {
    ...empty(t),
    favorite: i < 7,
    rating: i < 7 ? 4.5 : 0,
    watchlist: i >= 7 && i < 13,
    recommendationFeedback: i >= 13 ? "dislike" : undefined,
  };
}
test("carte : tous les liens correspondent aux genres ou aux similarités du modèle, disposition stable", () => {
  const a = buildTasteMap(seed),
    b = buildTasteMap(seed);
  expect(a.nodes).toEqual(b.nodes);
  expect(a.items).toHaveLength(18);
  const ids = new Set(a.nodes.map((n) => n.id));
  for (const edge of a.edges) {
    expect(ids.has(edge.a) && ids.has(edge.b)).toBe(true);
    expect(edge.strength).toBeGreaterThan(0);
    if (edge.kind === "genre") {
      const item = a.nodes.find((n) => n.id === edge.a)!.item!;
      expect(item.genres).toContain(Number(edge.b.split(":")[1]));
    }
  }
  expect(
    a.neighbours
      .get("movie-1")
      ?.some((item) => Number(item.id.split("-")[1]) < 7),
  ).toBe(true);
  for (const node of a.nodes) {
    const point = projectTastePoint(
      node,
      rotateTasteView(initialTasteRotation, 30, 20),
      1,
    );
    expect([point.x, point.y, point.depth].every(Number.isFinite)).toBe(true);
  }
  const limited = buildTasteMap(seed, [], 6);
  expect(limited.shown).toBe(6);
  expect(
    new Set(limited.nodes.flatMap((n) => (n.item ? [n.item.kind] : []))).size,
  ).toBe(3);
  expect(seed["movie-1"].favorite).toBe(true);
});
test("carte 3D : sélection, rotation, zoom, filtres et retour aux réglages sur mobile et PC", async ({
  page,
}, testInfo) => {
  await page.addInitScript(
    (library) =>
      localStorage.setItem("luma-library-v1", JSON.stringify(library)),
    seed,
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#settings/tastes");
  const map = page.getByRole("region", {
    name: "Carte de mes goûts",
    exact: true,
  });
  await expect(map).toBeVisible();
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("genre:878");
  await expect(
    page.getByRole("complementary", { name: "Détails du point sélectionné" }),
  ).toContainText("Affinité positive");
  await expect(
    page.getByRole("complementary", { name: "Détails du point sélectionné" }),
  ).toContainText("Station 1");
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("movie-1");
  await expect(
    page.getByRole("complementary", { name: "Détails du point sélectionné" }),
  ).toContainText("Station 1");
  const point = page.locator('[data-taste-id="movie-1"] circle').last();
  const before = await point.getAttribute("cx");
  const scene = page.getByRole("img", {
    name: "Carte interactive en trois dimensions de vos goûts",
    exact: true,
  });
  await scene.focus();
  await page.keyboard.press("ArrowRight");
  await expect(point).not.toHaveAttribute("cx", before!);
  await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  await expect(page.locator(".taste-selection")).toHaveCount(1);
  await page.getByRole("button", { name: "Refusés", exact: true }).click();
  await expect(page.locator(".taste-point.positive")).toHaveCount(0);
  await expect(page.locator(".taste-point.negative")).toHaveCount(6);
  await page.getByRole("button", { name: "Tout", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("Vela-carte-des-gouts-PC.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("Vela-carte-des-gouts-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await expect(page).toHaveURL(/#settings$/);
  await page
    .getByRole("button", { name: "Carte de mes goûts", exact: true })
    .click();
  await expect(map).toBeVisible();
  expect(await page.evaluate(() => (window as any).lumaHandleBack())).toBe(
    true,
  );
  await expect(page).toHaveURL(/#settings$/);
});
test("carte vide : aucun goût inventé", async ({ page }) => {
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.goto("/#settings/tastes");
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect(
    page.getByText("Votre carte commence avec vos goûts.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".taste-point")).toHaveCount(0);
});

test("terminal SF : lancement volontaire, intro accélérable, son local et retour au thème initial", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript((library) => {
    localStorage.setItem("luma-library-v1", JSON.stringify(library));
    localStorage.setItem("luma-theme", "light");
    (window as any).atlasAudio = { contexts: 0, notes: 0, closed: 0 };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        (window as any).atlasAudio.contexts++;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => {
          (window as any).atlasAudio.notes++;
          start(...args);
        };
        return oscillator;
      }
      close() {
        (window as any).atlasAudio.closed++;
        return super.close();
      }
    };
  }, seed);
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#settings/tastes");
  expect(await page.evaluate(() => (window as any).atlasAudio.contexts)).toBe(
    0,
  );
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".taste-scene")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  const progress = page.getByRole("progressbar", {
    name: "Initialisation de la carte",
  });
  await expect(progress).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.notes))
    .toBeGreaterThan(0);
  await expect(page.getByRole("status")).toHaveText(
    "Chargement de vos préférences mentales",
  );
  await page
    .getByRole("button", { name: "Son de la carte", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Son de la carte", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.closed))
    .toBe(1);
  await page
    .getByRole("button", { name: "Passer l’intro", exact: true })
    .click();
  await expect(page.locator(".taste-scene")).toBeVisible();
  const notes = await page.evaluate(() => (window as any).atlasAudio.notes);
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("movie-1");
  expect(await page.evaluate(() => (window as any).atlasAudio.notes)).toBe(
    notes,
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#030916",
  );
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass(/taste-terminal-active/);
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).not.toHaveAttribute(
    "content",
    "#030916",
  );
  await page
    .getByRole("button", { name: "Carte de mes goûts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Son de la carte", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Son de la carte", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.contexts))
    .toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.closed))
    .toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.contexts))
    .toBe(3);
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).atlasAudio.closed))
    .toBe(3);
});

test("terminal SF : fin naturelle, nettoyage audio et animations réduites sans intro", async ({
  page,
}) => {
  await page.addInitScript(
    (library) =>
      localStorage.setItem("luma-library-v1", JSON.stringify(library)),
    seed,
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#settings/tastes");
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect(page.locator(".taste-page")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Carte de mes goûts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect(page.locator(".taste-page")).toHaveAttribute(
    "data-phase",
    "ready",
  );
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Son de la carte", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Son de la carte", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  await expect(page.locator(".taste-scene")).toBeVisible();
});

test("terminal SF : audio indisponible sans bloquer la carte", async ({
  page,
}) => {
  await page.addInitScript((library) => {
    localStorage.setItem("luma-library-v1", JSON.stringify(library));
    Object.defineProperty(window, "AudioContext", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitAudioContext", {
      value: undefined,
      configurable: true,
    });
  }, seed);
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.goto("/#settings/tastes");
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Son de la carte", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Son de la carte", exact: true }),
  ).toHaveText("◖×Son indisponible");
  await expect(page.locator(".taste-scene")).toBeVisible();
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("movie-1");
  await expect(
    page.getByRole("complementary", { name: "Détails du point sélectionné" }),
  ).toContainText("Station 1");
});

test("rotation : le premier plan suit les gestes horizontaux et verticaux après toute orientation", () => {
  for (const [dx, dy] of [
    [0, 0],
    [200, 0],
    [0, 390],
    [130, -170],
  ]) {
    const rotation = rotateTasteView(initialTasteRotation, dx, dy);
    const inverse = {
      x: -rotation.x,
      y: -rotation.y,
      z: -rotation.z,
      w: rotation.w,
    };
    const back = projectTastePoint({ x: 0, y: 0, z: -120 }, inverse, 1);
    const front = {
      x: back.x / back.scale,
      y: back.y / back.scale,
      z: back.depth,
    };
    const at = projectTastePoint(front, rotation, 1);
    for (const [x, y] of [
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
    ]) {
      const moved = projectTastePoint(
        front,
        rotateTasteView(rotation, x, y),
        1,
      );
      if (x) expect((moved.x - at.x) * x).toBeGreaterThan(0);
      if (y) expect((moved.y - at.y) * y).toBeGreaterThan(0);
    }
  }
  const near = projectTastePoint(
    { x: 10, y: 0, z: -130 },
    initialTasteRotation,
    1,
  );
  const far = projectTastePoint(
    { x: 10, y: 0, z: 130 },
    initialTasteRotation,
    1,
  );
  expect(near.opacity).toBeGreaterThan(far.opacity * 3);
  expect(near.scale).toBeGreaterThan(far.scale);
});

test("réseau : plus de 170 goûts conservés, 300 points et un titre hors échantillon reste sélectionnable", () => {
  const large: Library = {};
  for (let i = 1; i <= 340; i++) {
    const entry = seed[`movie-${(i % 18) + 1}`];
    large[`movie-${i}`] = {
      ...entry,
      title: { ...entry.title, id: `movie-${i}`, name: `Titre ${i}` },
    };
  }
  const start = performance.now();
  const graph = buildTasteMap(large);
  expect(graph.items).toHaveLength(340);
  expect(graph.shown).toBe(300);
  const missing = graph.items.find(
    (item) => !graph.nodes.some((node) => node.id === item.id),
  )!;
  expect(
    buildTasteMap(large, [], 300, missing.id).nodes.some(
      (n) => n.id === missing.id,
    ),
  ).toBe(true);
  const radii = graph.nodes.map((n) => Math.hypot(n.x, n.y, n.z));
  expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(60);
  expect(performance.now() - start).toBeLessThan(5000);
});

test("scène : glissement sans cadre blanc, clavier repérable, arrière-plan atténué et liens réels", async ({
  page,
}) => {
  await page.addInitScript(
    (library) =>
      localStorage.setItem("luma-library-v1", JSON.stringify(library)),
    seed,
  );
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#settings/tastes");
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  const scene = page.locator(".taste-scene");
  await scene.scrollIntoViewIfNeeded();
  const box = (await scene.boundingBox())!;
  const start = await page
    .locator('[data-taste-id="movie-1"] .taste-star-core')
    .getAttribute("cx");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 70,
    box.y + box.height / 2 + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.locator('[data-taste-id="movie-1"] .taste-star-core'),
  ).not.toHaveAttribute("cx", start!);
  expect(await scene.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    "none",
  );
  await expect(page.locator(".taste-scene-wrap")).not.toHaveClass(
    /has-keyboard-focus/,
  );
  await scene.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".taste-scene-wrap")).toHaveClass(
    /has-keyboard-focus/,
  );
  await expect(page.locator(".atlas-keyboard-hint")).toBeVisible();
  expect(await scene.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    "none",
  );
  await expect(page.locator(".taste-orbit")).toHaveCount(0);
  const hit = page
    .locator('.taste-point.watchlist > circle[fill="transparent"]')
    .first();
  expect(await hit.evaluate((e) => getComputedStyle(e).stroke)).toBe("none");
  const nodes = await page.locator(".taste-point").evaluateAll((nodes) =>
    nodes.map((n) => ({
      depth: Number(n.getAttribute("data-depth")),
      opacity: Number(n.getAttribute("opacity")),
    })),
  );
  const sorted = nodes.sort((a, b) => a.depth - b.depth);
  expect(sorted[0].opacity).toBeGreaterThan(sorted.at(-1)!.opacity);
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("movie-1");
  await expect(page.locator(".taste-point.is-selected text")).toContainText(
    "Station 1",
  );
  expect(
    await page
      .locator(".atlas-terminal")
      .evaluate((e) => getComputedStyle(e).getPropertyValue("--brand").trim()),
  ).toBe("#328cff");
});

import { test, expect } from "./fixtures";
import { empty, type Library } from "../src/store";
import {
  initialTasteRotation,
  type TasteNode,
  type TasteEdge,
} from "../src/taste-map";
import {
  indexStellarGraph,
  visibleStellarScene,
} from "../src/stellar-visibility";
const camera = { rotation: initialTasteRotation, zoom: 1, pan: { x: 0, y: 0 } };
const nodes: TasteNode[] = [
  { id: "genre:28", genre: 28, label: "Action", weight: 3, x: 0, y: 0, z: 0 },
];
const library: Library = {};
const edges: TasteEdge[] = [];
for (let i = 1; i <= 300; i++) {
  const title = {
    id: `movie-${i}`,
    kind: "movie" as const,
    name: `Mission ${i}`,
    genres: ["Action", "Science-fiction"],
    genreIds: [28, 878],
    summary: "Une équipe explore une planète et sauve son équipage.",
    year: "2024",
    image: "",
  };
  library[title.id] = { ...empty(title), favorite: true, rating: 4.5 };
  nodes.push({
    id: title.id,
    label: title.name,
    weight: 3,
    x: ((i % 20) - 10) * 9,
    y: (Math.floor(i / 20) - 7) * 15,
    z: 0,
    item: {
      id: title.id,
      title,
      kind: "positive",
      weight: 3,
      rating: 4.5,
      favorite: true,
      genres: [28, 878],
      family: title.id,
    },
  });
  edges.push({ a: title.id, b: "genre:28", kind: "genre", strength: i / 300 });
}
nodes.push({ ...nodes[300], id: "remote", x: 10000 });
edges.push({ a: "remote", b: "genre:28", kind: "genre", strength: 2 });
const allowed = new Set(nodes.map((n) => n.id));

test("rendu : un gros genre affiche ses plus fortes connexions visibles, avec des budgets téléphone/PC/mouvement", () => {
  const index = indexStellarGraph(nodes, edges);
  const view = { width: 800, height: 800, compact: true };
  const scene = visibleStellarScene(index, camera, view, allowed, "genre:28");
  expect(scene.points.length).toBeLessThanOrEqual(140);
  expect(scene.links).toHaveLength(12);
  expect(scene.links.every((l) => l.active)).toBe(true);
  expect(scene.links.map((l) => l.edge.a)).toEqual(
    Array.from({ length: 12 }, (_, i) => `movie-${300 - i}`),
  );
  expect(scene.points.some((p) => p.id === "remote")).toBe(false);
  expect(scene.halos.size).toBeLessThanOrEqual(28);
  const moving = visibleStellarScene(
    index,
    camera,
    view,
    allowed,
    "genre:28",
    true,
  );
  expect(moving.links).toHaveLength(6);
  expect(moving.halos.size).toBeLessThanOrEqual(5);
  const desktop = visibleStellarScene(
    index,
    camera,
    { ...view, compact: false },
    allowed,
    "genre:28",
  );
  expect(desktop.links).toHaveLength(28);
  expect(desktop.points.length).toBeLessThanOrEqual(300);
  expect(index.nodes).toHaveLength(302);
  expect(index.ranked).toHaveLength(301);
  expect(nodes[300].x).toBe(-90); // render sorting never mutates the original graph.
});

test("rendu : les zones hors champ et les titres filtrés ne consomment aucun lien, puis réapparaissent au retour", () => {
  const index = indexStellarGraph(nodes, edges);
  const view = { width: 390, height: 844, compact: true };
  const remote = visibleStellarScene(
    index,
    { ...camera, pan: { x: -10000, y: 0 } },
    view,
    allowed,
    "genre:28",
  );
  expect(remote.points.map((p) => p.id)).toEqual(["remote"]);
  expect(remote.links).toHaveLength(0);
  const filtered = new Set(["movie-1"]);
  const scene = visibleStellarScene(index, camera, view, filtered, "genre:28");
  expect(scene.points.map((p) => p.id).sort()).toEqual(["genre:28", "movie-1"]);
  expect(scene.links.map((l) => l.edge.a)).toEqual(["movie-1"]);
  const back = visibleStellarScene(index, camera, view, allowed, "genre:28");
  expect(back.points.length).toBeGreaterThan(1);
  expect(back.links).toHaveLength(12);
});

test("téléphone : 300 titres, genre dense, sortie du champ, recherche et Canvas sans réallocation au déplacement", async ({
  page,
}) => {
  await page.addInitScript(
    (library) =>
      localStorage.setItem("luma-library-v1", JSON.stringify(library)),
    library,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#settings/tastes");
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("genre:28");
  await expect(page.locator(".stellar-map")).not.toHaveClass(/is-navigating/);
  expect(await page.locator(".taste-point").count()).toBeLessThanOrEqual(140);
  expect(
    Number(await page.locator(".taste-scene").getAttribute("data-link-count")),
  ).toBeLessThanOrEqual(100);
  expect(
    await page.locator(".taste-edge.is-selected").count(),
  ).toBeLessThanOrEqual(12);
  expect(await page.locator(".taste-edge.is-selected").count()).toBeGreaterThan(
    0,
  );
  expect(await page.locator(".taste-star-halo").count()).toBeLessThanOrEqual(
    28,
  );
  await expect(
    page.getByLabel("Choisir un point", { exact: true }).locator("option"),
  ).toHaveCount(303);
  await page.evaluate(() => {
    (window as any).canvasResizes = 0;
    const observer = new MutationObserver((records) => {
      (window as any).canvasResizes += records.length;
    });
    observer.observe(document.querySelector("canvas.stellar-backdrop")!, {
      attributes: true,
      attributeFilter: ["width", "height"],
    });
  });
  await page.locator("svg.taste-scene").focus();
  for (let i = 0; i < 45; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator(".taste-point")).toHaveCount(0);
  await expect(page.locator(".taste-scene")).toHaveAttribute(
    "data-link-count",
    "0",
  );
  expect(await page.evaluate(() => (window as any).canvasResizes)).toBe(0);
  await page.keyboard.press("Home");
  await expect
    .poll(() => page.locator(".taste-point").count())
    .toBeGreaterThan(0);
  await page
    .getByLabel("Choisir un point", { exact: true })
    .selectOption("movie-300");
  await expect(
    page.locator('[data-taste-id="movie-300"].is-selected'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ouvrir la fiche", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Mission 300");
});

test("densité au repos : les genres conservent plusieurs branches et davantage de titres sont reliés", () => {
  const index = indexStellarGraph(nodes, edges);
  const view = { width: 1000, height: 800, compact: true };
  const resting = visibleStellarScene(index, camera, view, allowed, "");
  const moving = visibleStellarScene(index, camera, view, allowed, "", true);
  expect(resting.links.length).toBeGreaterThanOrEqual(18);
  expect(resting.links.length).toBeGreaterThan(moving.links.length * 2);
  expect(resting.points.length).toBeGreaterThan(moving.points.length);
  const richer = indexStellarGraph(nodes, [
    ...edges,
    ...nodes
      .slice(1, 300)
      .map((node, i) => ({
        a: node.id,
        b: nodes[i + 2].id,
        strength: 0.8,
        kind: "similarity" as const,
      })),
  ]);
  const full = visibleStellarScene(richer, camera, view, allowed, "genre:28");
  expect(full.links.length).toBeGreaterThan(70);
  expect(full.links.length).toBeLessThanOrEqual(100);
  expect(full.links.filter((l) => l.active)).toHaveLength(12);
});

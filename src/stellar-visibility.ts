import {
  projectTastePoint,
  type TasteEdge,
  type TasteNode,
  type TasteRotation,
} from "./taste-map";

export type StellarPoint = TasteNode &
  ReturnType<typeof projectTastePoint> & { sceneX: number; sceneY: number };
export type StellarCamera = {
  rotation: TasteRotation;
  zoom: number;
  pan: { x: number; y: number };
};

// The graph is small, private data. Build its adjacency/ranking once, never in a camera frame.
export function indexStellarGraph(nodes: TasteNode[], edges: TasteEdge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const importance = (id: string) =>
    Math.min(5, Math.abs(byId.get(id)?.weight || 0)) / 5;
  const ranked = edges
    .map((edge, order) => ({
      ...edge,
      order,
      priority:
        edge.strength + (importance(edge.a) + importance(edge.b)) * 0.12,
    }))
    .sort((a, b) => b.priority - a.priority || a.order - b.order);
  const adjacent = new Map<string, typeof ranked>();
  for (const edge of ranked)
    for (const id of [edge.a, edge.b]) {
      const list = adjacent.get(id) || [];
      list.push(edge);
      adjacent.set(id, list);
    }
  return { nodes, ranked, adjacent };
}

export function stellarBudget(compact: boolean, moving = false) {
  return compact
    ? {
        stars: moving ? 60 : 100,
        edges: moving ? 16 : 40,
        selectedEdges: moving ? 6 : 12,
        halos: moving ? 5 : 16,
        degree: 2,
      }
    : {
        stars: moving ? 160 : 220,
        edges: moving ? 48 : 120,
        selectedEdges: moving ? 12 : 28,
        halos: moving ? 12 : 36,
        degree: 3,
      };
}

export function visibleStellarScene(
  index: ReturnType<typeof indexStellarGraph>,
  camera: StellarCamera,
  view: { width: number; height: number; compact: boolean },
  allowed: ReadonlySet<string>,
  selected: string,
  moving = false,
) {
  const budget = stellarBudget(view.compact, moving);
  const half = (600 * view.width) / view.height / 2;
  // Small pixel-sized overscan avoids popping at the edge without mounting the whole map.
  const margin = (24 * 600) / view.height;
  const candidates: StellarPoint[] = [];
  for (const n of index.nodes) {
    if (n.item && !allowed.has(n.id)) continue;
    const p = projectTastePoint(n, camera.rotation, camera.zoom);
    const x = p.x + camera.pan.x,
      y = p.y + camera.pan.y;
    if (
      p.scale <= 0 ||
      !Number.isFinite(x + y) ||
      x < -half - margin ||
      x > half + margin ||
      y < -300 - margin ||
      y > 300 + margin
    )
      continue;
    candidates.push({ ...n, ...p, sceneX: p.x, sceneY: p.y, x, y });
  }
  const inView = new Set(candidates.map((n) => n.id));
  const preferred = new Set<string>();
  // A busy genre gets only its strongest *visible* neighbours, not hundreds of highlights.
  for (const edge of index.adjacent.get(selected) || []) {
    const id = edge.a === selected ? edge.b : edge.a;
    if (inView.has(id)) preferred.add(id);
    if (preferred.size >= budget.selectedEdges) break;
  }
  const priority = (p: StellarPoint) =>
    (p.id === selected ? 1e6 : 0) +
    (preferred.has(p.id) ? 1e4 : 0) +
    (p.genre !== undefined ? 20 : 0) +
    Math.min(5, Math.abs(p.weight)) +
    p.opacity * 2 -
    Math.hypot(p.x, p.y) * 0.002;
  candidates.sort(
    (a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id),
  );
  const points = candidates.slice(0, budget.stars);
  const byId = new Map(points.map((p) => [p.id, p]));
  const links: {
    edge: (typeof index.ranked)[number];
    a: StellarPoint;
    b: StellarPoint;
    active: boolean;
  }[] = [];
  const degrees = new Map<string, number>();
  const added = new Set<number>();
  let selectedCount = 0;
  const add = (edge: (typeof index.ranked)[number], active: boolean) => {
    if (links.length >= budget.edges || added.has(edge.order)) return;
    const a = byId.get(edge.a),
      b = byId.get(edge.b);
    if (!a || !b || (!active && a.depth > 180 && b.depth > 180)) return;
    if (active && selectedCount >= budget.selectedEdges) return;
    if (
      [a, b].some(
        (n) =>
          (degrees.get(n.id) || 0) >=
          (n.id === selected ? budget.selectedEdges : budget.degree),
      )
    )
      return;
    links.push({ edge, a, b, active });
    added.add(edge.order);
    for (const n of [a, b]) degrees.set(n.id, (degrees.get(n.id) || 0) + 1);
    if (active) selectedCount++;
  };
  for (const edge of index.adjacent.get(selected) || []) add(edge, true);
  for (const edge of index.ranked) {
    if (links.length >= budget.edges) break;
    add(edge, edge.a === selected || edge.b === selected);
  }
  const linked = new Set([selected]);
  for (const link of links)
    if (link.active) {
      linked.add(link.a.id);
      linked.add(link.b.id);
    }
  const halos = new Set(points.slice(0, budget.halos).map((p) => p.id));
  points.sort((a, b) => b.depth - a.depth);
  return { points, links, linked, halos, budget };
}

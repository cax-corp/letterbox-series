import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { t as tr } from "./i18n";
import { ArrowRight, Bookmark, Heart, Plus, Search, X } from "./icons";
import { normalTitle } from "./taste-features";
import {
  projectTastePoint,
  rotateTasteView,
  initialTasteRotation,
  type buildTasteMap,
  type TasteNode,
} from "./taste-map";
import type { Title } from "./catalog";
import StellarBackdrop from "./StellarBackdrop";
import StellarStar from "./StellarStar";
import { indexStellarGraph, visibleStellarScene } from "./stellar-visibility";
type Graph = ReturnType<typeof buildTasteMap>;
type Camera = {
  rotation: typeof initialTasteRotation;
  zoom: number;
  pan: { x: number; y: number };
};
const initial: Camera = {
  rotation: initialTasteRotation,
  zoom: 1,
  pan: { x: 0, y: 0 },
};
const starColors = {
  positive: "#91c8ff",
  negative: "#ed98b2",
  watchlist: "#c4b3f1",
  skip: "#a5b9d3",
  neutral: "#b7cadf",
  anchor: "#ffe0a3",
};
const labels = {
  positive: "Apprécié",
  negative: "Refusé ou mal noté",
  watchlist: "À voir",
  skip: "Passé rapidement",
  neutral: "Vu sans préférence forte",
};
const label = (n: TasteNode) => (n.genre === undefined ? n.label : tr(n.label));
const world = (n: TasteNode) => ({
  ...n,
  x: n.x * 2.5,
  y: n.y * 1.8,
  z: n.z * 1.9,
});
export default function StellarMap({
  map,
  pin,
  open,
  play,
}: {
  map: Graph;
  pin: (id: string) => void;
  open: (title: Title) => void;
  play: () => void;
}) {
  const [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [mode, setMode] = useState<"pan" | "orbit">("pan"),
    [expanded, setExpanded] = useState(false),
    [help, setHelp] = useState(false),
    [keyboard, setKeyboard] = useState(false),
    [moving, setMoving] = useState(false);
  const navigation = useRef(false),
    idle = useRef(0);
  const coarse = useMemo(() => matchMedia("(pointer: coarse)").matches, []);
  const [camera, setCamera] = useState<Camera>(initial),
    current = useRef(camera),
    frame = useRef(0),
    flight = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const scene = useRef<SVGSVGElement>(null),
    root = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    drag = useRef({ distance: 0, id: "", multi: false });
  const [size, setSize] = useState({ width: 1000, height: 800 });
  const width = (600 * size.width) / size.height,
    half = width / 2;
  const nodes = useMemo(() => map.nodes.map(world), [map]);
  const compact = coarse || size.width <= 760;
  const index = useMemo(
    () => indexStellarGraph(nodes, map.edges),
    [nodes, map.edges],
  );
  const visible = useMemo(
    () =>
      new Set(
        map.items
          .filter(
            (item) =>
              (filter === "all" || item.kind === filter) &&
              normalTitle(
                `${item.title.name} ${item.title.original || ""}`,
              ).includes(normalTitle(query)),
          )
          .map((item) => item.id),
      ),
    [map.items, filter, query],
  );
  const { points, links, linked, halos } = useMemo(
    () =>
      visibleStellarScene(
        index,
        camera,
        { ...size, compact },
        visible,
        selected,
        moving,
      ),
    [index, camera, size, compact, visible, selected, moving],
  );
  const chosen = map.items.find((item) => item.id === selected),
    genre = map.nodes.find((n) => n.id === selected && n.genre !== undefined);
  const labelIds = new Set<string>(),
    occupied: { x: number; y: number }[] = [];
  for (const p of [...points].sort(
    (a, b) =>
      Number(b.id === selected) - Number(a.id === selected) ||
      a.depth - b.depth,
  )) {
    if (p.item && !visible.has(p.id)) continue;
    if (p.x < -half + 12 || p.x > half - 12 || p.y < -235 || p.y > 215)
      continue;
    if (
      p.id !== selected &&
      (p.depth > 170 ||
        (p.item && !(query || linked.has(p.id) || Math.abs(p.weight) > 2.5)) ||
        occupied.some(
          (o) => Math.abs(o.x - p.x) < 100 && Math.abs(o.y - p.y) < 28,
        ))
    )
      continue;
    if (labelIds.size > (size.width < 650 ? 5 : 12) && p.id !== selected)
      continue;
    labelIds.add(p.id);
    occupied.push(p);
  }
  function move(next: Partial<Camera>) {
    if (!navigation.current) {
      navigation.current = true;
      setMoving(true);
    }
    clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      navigation.current = false;
      setMoving(false);
    }, 130);
    current.current = { ...current.current, ...next };
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setCamera(current.current);
      });
  }
  function stop() {
    cancelAnimationFrame(flight.current);
    flight.current = 0;
  }
  function fly(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    stop();
    const from = current.current,
      zoom = Math.max(from.zoom, 1.05),
      p = projectTastePoint(node, from.rotation, zoom);
    const target = {
      x: -p.x - (size.width > 760 ? width * 0.12 : 0),
      y: -p.y - (size.width < 650 ? 25 : 0),
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      move({ zoom, pan: target });
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const a = Math.min(1, (now - start) / 360),
        ease = 1 - (1 - a) ** 3;
      move({
        zoom: from.zoom + (zoom - from.zoom) * ease,
        pan: {
          x: from.pan.x + (target.x - from.pan.x) * ease,
          y: from.pan.y + (target.y - from.pan.y) * ease,
        },
      });
      if (a < 1) flight.current = requestAnimationFrame(tick);
      else flight.current = 0;
    };
    flight.current = requestAnimationFrame(tick);
  }
  function choose(id: string) {
    setSelected(id);
    play();
    if (id && !nodes.some((n) => n.id === id)) pin(id);
    else if (id) {
      pending.current = id;
      fly(id);
    }
  }
  const pending = useRef("");
  useEffect(() => {
    if (
      selected &&
      nodes.some((n) => n.id === selected) &&
      pending.current !== selected
    ) {
      pending.current = selected;
      fly(selected);
    }
  }, [nodes, selected]);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setSize({ width: r.width, height: r.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    heading.current?.focus({ preventScroll: true });
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(idle.current);
      stop();
    },
    [],
  );
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const factor = Math.exp(
        -Math.max(-180, Math.min(180, e.deltaY)) * 0.0025,
      );
      move({
        zoom: Math.max(0.25, Math.min(3.2, current.current.zoom * factor)),
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const mini = useMemo(() => {
    if (compact && selected) return [];
    const limit = compact ? 70 : 140;
    const sample =
      nodes.length <= limit
        ? nodes
        : Array.from(
            { length: limit },
            (_, i) => nodes[Math.floor((i * (nodes.length - 1)) / (limit - 1))],
          );
    return sample.map((n) => ({
      ...n,
      ...projectTastePoint(n, camera.rotation, 1),
    }));
  }, [nodes, camera.rotation, compact, selected]);
  const extent = Math.max(
    230,
    ...mini.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))),
  );
  const miniStars = useMemo(
    () =>
      mini.map((n) => (
        <circle
          key={n.id}
          cx={(n.x / extent) * 170}
          cy={(n.y / extent) * 106}
          r={n.id === selected ? 5 : n.item ? 1.4 : 2.3}
          fill={n.id === selected ? "#ffe1a1" : n.item ? "#a4cfff" : "#e4f3ff"}
          opacity={n.item?.kind === "negative" ? 0.4 : 0.75}
        />
      )),
    [mini, selected, extent],
  );
  const titleOptions = useMemo(
    () =>
      map.items
        .filter((item) => visible.has(item.id))
        .map((item) => (
          <option key={item.id} value={item.id}>
            {item.title.name}
          </option>
        )),
    [map.items, visible],
  );
  const reset = () => {
    stop();
    setSelected("");
    const projected = nodes.map((n) =>
      projectTastePoint(n, initialTasteRotation, 1),
    );
    if (!projected.length) {
      move(initial);
      return;
    }
    const left = Math.min(...projected.map((p) => p.x)),
      right = Math.max(...projected.map((p) => p.x));
    const top = Math.min(...projected.map((p) => p.y)),
      bottom = Math.max(...projected.map((p) => p.y));
    const zoom = Math.max(
      0.25,
      Math.min(
        1.4,
        (width * 0.78) / (right - left + 80),
        (600 * 0.68) / (bottom - top + 80),
      ),
    );
    move({
      rotation: initialTasteRotation,
      zoom,
      pan: { x: (-(left + right) * zoom) / 2, y: (-(top + bottom) * zoom) / 2 },
    });
  };
  return (
    <div ref={root} className={`stellar-map ${moving ? "is-navigating" : ""}`}>
      <StellarBackdrop
        rotation={camera.rotation}
        zoom={camera.zoom}
        pan={camera.pan}
      />
      <div
        className={`taste-scene-wrap stellar-field ${keyboard ? "has-keyboard-focus" : ""}`}
      >
        <svg
          ref={scene}
          className="taste-scene"
          viewBox={`${-half} -300 ${width} 600`}
          role="img"
          aria-label={tr("Carte interactive en trois dimensions de vos goûts")}
          tabIndex={0}
          onFocus={(e) =>
            setKeyboard(e.currentTarget.matches(":focus-visible"))
          }
          onBlur={() => setKeyboard(false)}
          onKeyDown={(e) => {
            const delta = e.shiftKey ? 36 : 16;
            let dx = 0,
              dy = 0;
            if (["ArrowLeft", "a", "A"].includes(e.key)) dx = -delta;
            else if (["ArrowRight", "d", "D"].includes(e.key)) dx = delta;
            else if (["ArrowUp", "w", "W"].includes(e.key)) dy = -delta;
            else if (["ArrowDown", "s", "S"].includes(e.key)) dy = delta;
            else if (e.key === "+" || e.key === "=")
              move({ zoom: Math.min(3.2, current.current.zoom * 1.15) });
            else if (e.key === "-")
              move({ zoom: Math.max(0.25, current.current.zoom / 1.15) });
            else if (e.key === "Home") reset();
            else return;
            e.preventDefault();
            setKeyboard(true);
            stop();
            if (dx || dy) {
              if (mode === "orbit")
                move({
                  rotation: rotateTasteView(current.current.rotation, dx, dy),
                });
              else
                move({
                  pan: {
                    x: current.current.pan.x + dx,
                    y: current.current.pan.y + dy,
                  },
                });
            }
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            stop();
            e.currentTarget.focus({ preventScroll: true });
            setKeyboard(false);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            drag.current = {
              distance: 0,
              multi: pointers.current.size > 1,
              id:
                (e.target as Element)
                  .closest("[data-taste-id]")
                  ?.getAttribute("data-taste-id") || "",
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const old = pointers.current.get(e.pointerId);
            if (!old) return;
            const dx = e.clientX - old.x,
              dy = e.clientY - old.y;
            drag.current.distance += Math.hypot(dx, dy);
            if (pointers.current.size === 2) {
              const other = [...pointers.current].find(
                  ([id]) => id !== e.pointerId,
                )![1],
                before = Math.hypot(old.x - other.x, old.y - other.y),
                after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
              if (before > 0)
                move({
                  zoom: Math.max(
                    0.25,
                    Math.min(3.2, (current.current.zoom * after) / before),
                  ),
                });
            } else if (mode === "orbit")
              move({
                rotation: rotateTasteView(
                  current.current.rotation,
                  (dx * 600) / size.height,
                  (dy * 600) / size.height,
                ),
              });
            else
              move({
                pan: {
                  x: Math.max(
                    -1500,
                    Math.min(
                      1500,
                      current.current.pan.x + (dx * 600) / size.height,
                    ),
                  ),
                  y: Math.max(
                    -1200,
                    Math.min(
                      1200,
                      current.current.pan.y + (dy * 600) / size.height,
                    ),
                  ),
                },
              });
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }}
          onPointerUp={(e) => {
            if (
              !drag.current.multi &&
              drag.current.distance < 6 &&
              drag.current.id
            )
              choose(drag.current.id);
            pointers.current.delete(e.pointerId);
          }}
          onPointerCancel={(e) => {
            pointers.current.delete(e.pointerId);
            drag.current.id = "";
          }}
          onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
        >
          <defs>
            {Object.entries(starColors).map(([kind, color]) => (
              <radialGradient key={kind} id={`stellar-glow-${kind}`}>
                <stop stopColor={color} stopOpacity=".75" />
                <stop offset=".16" stopColor={color} stopOpacity=".35" />
                <stop offset=".45" stopColor={color} stopOpacity=".09" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </radialGradient>
            ))}
            <radialGradient id="stellar-glow">
              <stop stopColor="currentColor" stopOpacity=".65" />
              <stop offset=".16" stopColor="currentColor" stopOpacity=".3" />
              <stop offset=".45" stopColor="currentColor" stopOpacity=".08" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="stellar-flare">
              <stop stopColor="#a4d3ff" stopOpacity="0" />
              <stop offset=".5" stopColor="#e6f7ff" stopOpacity=".6" />
              <stop offset="1" stopColor="#a4d3ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${camera.pan.x} ${camera.pan.y})`}>
            {links.map(({ edge, a, b, active }) => {
              return (
                <line
                  key={edge.order}
                  x1={a.sceneX}
                  y1={a.sceneY}
                  x2={b.sceneX}
                  y2={b.sceneY}
                  className={`taste-edge ${active ? "is-selected" : ""} ${edge.kind}`}
                  strokeOpacity={active ? 0.78 : query ? 0.16 : 0.055}
                  strokeWidth={active ? 0.65 : 0.3}
                />
              );
            })}
            {points.map((p) => {
              const active = selected === p.id,
                r =
                  (p.item
                    ? 1.1 + Math.min(1.35, Math.abs(p.weight) * 0.16)
                    : 1.5) * Math.min(2, p.scale),
                opacity = active
                  ? 1
                  : Math.max(0.17, p.opacity) *
                    (selected && !linked.has(p.id) ? 0.65 : 1);
              return (
                <StellarStar
                  key={p.id}
                  id={p.id}
                  x={p.sceneX}
                  y={p.sceneY}
                  radius={r}
                  depth={p.depth}
                  opacity={opacity}
                  active={active}
                  halo={halos.has(p.id)}
                  flare={
                    active ||
                    (!moving &&
                      halos.has(p.id) &&
                      p.depth < 0 &&
                      Math.abs(p.weight) > 3)
                  }
                  kind={p.item?.kind || "anchor"}
                  name={`${label(p)}${p.item ? ` · ${tr(labels[p.item.kind])}` : ""}`}
                  caption={labelIds.has(p.id) ? label(p) : ""}
                />
              );
            })}
          </g>
        </svg>
      </div>
      <div className="stellar-navigation">
        <div className="stellar-heading">
          <span className="stellar-kicker">VELA / STELLAR ATLAS</span>
          <h1 ref={heading} tabIndex={-1}>
            {tr("Carte de mes goûts")}
          </h1>
          <span className="stellar-count">
            {map.shown} {tr("étoiles personnelles")} · {map.items.length}{" "}
            {tr("titres")}
          </span>
        </div>
        <label className="stellar-search">
          <Search size={17} />
          <span className="sr-only">{tr("Rechercher un titre")}</span>
          <input
            type="search"
            aria-label={tr("Rechercher un titre")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Un film, une série…")}
          />
        </label>
        <label className="stellar-choose">
          <span className="sr-only">{tr("Choisir un point")}</span>
          <select
            aria-label={tr("Choisir un point")}
            value={selected}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">{tr("Rejoindre un titre ou un genre")}</option>
            <optgroup label={tr("Genres")}>
              {map.nodes
                .filter((n) => n.genre !== undefined)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {tr(n.label)}
                  </option>
                ))}
            </optgroup>
            {titleOptions}
          </select>
        </label>
        <div
          className="taste-filters"
          role="group"
          aria-label={tr("Afficher les goûts")}
        >
          {[
            ["all", "Tout"],
            ["positive", "Appréciés"],
            ["watchlist", "À voir"],
            ["negative", "Refusés"],
            ["skip", "Passés"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                reset();
              }}
            >
              {tr(name)}
            </button>
          ))}
        </div>
      </div>
      <button
        className="stellar-minimap"
        aria-label={tr("Vue d’ensemble de la carte")}
        onClick={reset}
      >
        <svg viewBox="-200 -130 400 260" aria-hidden="true">
          <ellipse
            rx="175"
            ry="106"
            fill="none"
            stroke="#91bfea"
            strokeOpacity=".18"
          />
          {miniStars}
          <path
            d={`M${(-camera.pan.x / camera.zoom / extent) * 170 - 8},${(-camera.pan.y / camera.zoom / extent) * 106}h16 M${(-camera.pan.x / camera.zoom / extent) * 170},${(-camera.pan.y / camera.zoom / extent) * 106 - 8}v16`}
            stroke="#f4d095"
            strokeWidth="1.3"
          />
        </svg>
        <span>
          {tr("Vue d’ensemble")}
          <small>{tr("Recentrer")}</small>
        </span>
      </button>
      {(chosen || genre) && (
        <aside
          className={`taste-inspector stellar-inspector ${expanded ? "is-expanded" : ""}`}
          aria-label={tr("Détails du point sélectionné")}
        >
          <div className="stellar-card-heading">
            <span>{tr("SYSTÈME SÉLECTIONNÉ")}</span>
            <button
              className="icon-button"
              aria-label={tr("Fermer les détails du point")}
              onClick={() => setSelected("")}
            >
              <X size={17} />
            </button>
          </div>
          <span className={`taste-status ${chosen?.kind || ""}`}>
            {chosen
              ? tr(labels[chosen.kind])
              : `${tr("Genre ·")} ${tr(genre!.weight > 0.2 ? "Affinité positive" : genre!.weight < -0.2 ? "Affinité négative" : "Signaux légers ou partagés")}`}
          </span>
          <h2>{chosen?.title.name || tr(genre!.label)}</h2>
          {chosen && (
            <p className="stellar-card-meta">
              {chosen.title.year} ·{" "}
              {chosen.title.genres.map((g) => tr(g)).join(" / ")}
              {chosen.rating > 0 ? ` · ${chosen.rating}/5` : ""}
            </p>
          )}
          <button
            className="stellar-expand"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {tr(expanded ? "Réduire les détails" : "Explorer les connexions")}{" "}
            <ArrowRight size={16} />
          </button>
          <div className="stellar-card-body">
            {chosen?.favorite && (
              <p className="taste-favorite">
                <Heart size={14} />
                {tr("Coup de cœur")}
              </p>
            )}
            <p>
              {tr(
                chosen?.kind === "skip"
                  ? "Un signal faible et temporaire. Passer rapidement un titre pèse beaucoup moins qu’un refus explicite."
                  : chosen?.kind === "watchlist"
                    ? "Une envie de découverte. Ce titre ne compte pas comme un film déjà aimé."
                    : chosen?.kind === "negative"
                      ? "Ce signal réduit la priorité des recommandations semblables."
                      : chosen
                        ? "Ce titre aide à trouver d’autres films proches. Plusieurs favoris d’une même famille sont équilibrés pour garder de la variété."
                        : "Ce repère relie vos titres de ce genre. Son affinité résume vos notes, coups de cœur et envies, en équilibrant les familles de films.",
              )}
            </p>
            <div className="taste-neighbours">
              <h3>{tr(chosen ? "Liens proches" : "Titres liés")}</h3>
              {(chosen
                ? (map.neighbours.get(chosen.id) || [])
                    .map((n) => map.items.find((i) => i.id === n.id)!)
                    .filter(Boolean)
                : map.items
                    .filter((i) =>
                      i.genres.length
                        ? i.genres.includes(genre!.genre!)
                        : genre!.genre === 0,
                    )
                    .slice(0, 6)
              ).map((item) => (
                <button
                  className="text-button"
                  key={item.id}
                  onClick={() => choose(item.id)}
                >
                  {item.title.name}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>
          {chosen && (
            <button
              className="button tonal stellar-open"
              onClick={() => open(chosen.title)}
            >
              {tr("Ouvrir la fiche")}
              <ArrowRight size={17} />
            </button>
          )}
        </aside>
      )}
      {!map.items.length && (
        <div className="stellar-empty">
          <Bookmark size={25} />
          <h2>{tr("Votre carte commence avec vos goûts.")}</h2>
          <p>
            {tr(
              "Notez des titres, ajoutez des coups de cœur ou remplissez votre liste « À voir » pour la découvrir.",
            )}
          </p>
        </div>
      )}
      <div className="stellar-bottom">
        <div
          className="stellar-modes"
          role="group"
          aria-label={tr("Navigation de la carte")}
        >
          <button aria-pressed={mode === "pan"} onClick={() => setMode("pan")}>
            {tr("Déplacement")}
          </button>
          <button
            aria-pressed={mode === "orbit"}
            onClick={() => setMode("orbit")}
          >
            {tr("Rotation")}
          </button>
        </div>
        <div className="taste-controls">
          <button
            className="icon-button"
            aria-label={tr("Dézoomer")}
            onClick={() =>
              move({ zoom: Math.max(0.25, current.current.zoom / 1.2) })
            }
          >
            −
          </button>
          <span>{Math.round(camera.zoom * 100)}%</span>
          <button
            className="icon-button"
            aria-label={tr("Zoomer")}
            onClick={() =>
              move({ zoom: Math.min(3.2, current.current.zoom * 1.2) })
            }
          >
            <Plus size={19} />
          </button>
          <button className="stellar-reset" onClick={reset}>
            {tr("Recentrer")}
          </button>
        </div>
        <button
          className="stellar-help-button"
          aria-expanded={help}
          onClick={() => setHelp((v) => !v)}
        >
          {tr("Lire la carte")}
        </button>
      </div>
      <p className="stellar-hint">
        {keyboard
          ? tr("Flèches : déplacement · + / − : zoom · Début : recentrer")
          : tr(
              "Glissez pour explorer · Pincez ou utilisez la molette pour zoomer",
            )}
      </p>
      {help && (
        <div
          className="stellar-help"
          role="region"
          aria-label={tr("Comment lire cette carte ?")}
        >
          <button
            className="icon-button"
            aria-label={tr("Fermer")}
            onClick={() => setHelp(false)}
          >
            <X size={17} />
          </button>
          <h2>{tr("Comment lire cette carte ?")}</h2>
          <p>
            {tr(
              "Chaque étoile sélectionnable correspond à un titre de votre bibliothèque. Les repères regroupent les genres ; les routes affichées relient des contenus proches par leurs genres et leurs synopsis.",
            )}
          </p>
          <div className="taste-legend">
            {(["positive", "watchlist", "negative", "skip"] as const).map(
              (kind) => (
                <span key={kind}>
                  <i className={kind} />
                  {tr(labels[kind])}
                </span>
              ),
            )}
          </div>
          <p>
            {tr(
              "Les nébuleuses et la poussière d’étoiles sont décoratives. Les positions et les distances sont une représentation visuelle, pas un pourcentage de compatibilité.",
            )}
          </p>
          <p>
            {map.shown} / {map.items.length}{" "}
            {tr(
              "titres cartographiés · tous restent accessibles par la recherche",
            )}
          </p>
        </div>
      )}
    </div>
  );
}

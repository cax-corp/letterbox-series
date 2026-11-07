import { t as tr } from "./i18n";
import { updateSystemAppearance } from "./appearance";
import { useTasteSound } from "./useTasteSound";
import { normalTitle } from "./taste-features";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Heart, Plus, Search } from "./icons";
import {
  buildTasteMap,
  projectTastePoint,
  rotateTasteView,
  initialTasteRotation,
  type TasteItem,
} from "./taste-map";
import { readSkipSignals } from "./implicit-feedback";
import type { Library } from "./store";
import type { Title } from "./catalog";
const bootSteps = [
  "Lecture de la bibliothèque locale",
  "Chargement de vos préférences mentales",
  "Connexion des affinités cinématographiques",
  "Cartographie prête à explorer",
];
// Decorative background dust is separate from personal nodes and is never selectable.
const stardust = Array.from({ length: 95 }, (_, i) => ({
  x: ((i * 137.508) % 470) - 235,
  y: ((i * i * 23.17) % 400) - 200,
  r: i % 7 === 0 ? 0.75 : 0.35,
}));
function pointLabel(point: { label: string; genre?: number }) {
  return point.genre === undefined ? point.label : tr(point.label);
}
const labels: Record<TasteItem["kind"], string> = {
  positive: "Apprécié",
  negative: "Refusé ou mal noté",
  watchlist: "À voir",
  skip: "Passé rapidement",
  neutral: "Vu sans préférence forte",
};
export default function TasteMap({
  library,
  account,
  close,
  open,
}: {
  library: Library;
  account: string;
  close: () => void;
  open: (title: Title) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "boot" | "ready">("idle");
  const [step, setStep] = useState(0);
  const sound = useTasteSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const readyHeading = useRef<HTMLHeadingElement>(null);
  const immersive = phase !== "idle";
  useEffect(() => {
    if (!immersive) return;
    let active = true;
    document.body.classList.add("taste-terminal-active");
    const palette = () =>
      document.documentElement.dataset.colourTheme || "blue";
    void updateSystemAppearance(false, palette())
      .then(() => {
        if (active)
          document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", "#030916");
      })
      .catch(() => {});
    return () => {
      active = false;
      document.body.classList.remove("taste-terminal-active");
      void updateSystemAppearance(
        document.documentElement.dataset.theme === "light",
        palette(),
      ).catch(() => {});
    };
  }, [immersive]);
  useEffect(() => {
    if (phase !== "boot") return;
    const timers = bootSteps.slice(1).map((_, i) =>
      window.setTimeout(
        () => {
          setStep(i + 1);
          soundRef.current.play("step");
        },
        (i + 1) * 520,
      ),
    );
    timers.push(
      window.setTimeout(() => {
        setPhase("ready");
        soundRef.current.play("ready");
      }, 2200),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);
  useEffect(() => {
    if (phase === "ready") readyHeading.current?.focus({ preventScroll: true });
  }, [phase]);
  function launch() {
    sound.play("launch", true);
    setPhase(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "ready"
        : "boot",
    );
  }
  const [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [pinned, setPinned] = useState("");
  const [keyboardScene, setKeyboardScene] = useState(false);
  const [camera, setCamera] = useState({
    rotation: initialTasteRotation,
    zoom: 1,
  });
  const current = useRef(camera),
    frame = useRef(0),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    drag = useRef({ distance: 0, id: "", multi: false });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === account) setRevision((n) => n + 1);
    };
    window.addEventListener("vela-taste-state", changed);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener("vela-taste-state", changed);
    };
  }, [account]);
  const map = useMemo(
    () => buildTasteMap(library, readSkipSignals(account), 300, pinned),
    [library, account, revision, pinned],
  );
  function move(patch: Partial<typeof camera>) {
    current.current = { ...current.current, ...patch };
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setCamera(current.current);
      });
  }
  function choose(id: string) {
    if (id && !map.nodes.some((node) => node.id === id)) setPinned(id);
    setSelected(id);
  }
  const chosen = map.items.find((item) => item.id === selected);
  const chosenGenre = map.nodes.find(
    (node) => node.id === selected && node.genre !== undefined,
  );
  const matches = (item: TasteItem) =>
    (filter === "all" || item.kind === filter) &&
    normalTitle(`${item.title.name} ${item.title.original || ""}`).includes(
      normalTitle(query),
    );
  const visibleItems = map.items.filter(matches),
    visible = new Set(visibleItems.map((item) => item.id));
  const points = map.nodes.map((node) => ({
    ...node,
    ...projectTastePoint(node, camera.rotation, camera.zoom),
  }));
  const byId = new Map(points.map((point) => [point.id, point]));
  const connected = new Set([selected]);
  if (selected)
    for (const edge of map.edges) {
      if (edge.a === selected) connected.add(edge.b);
      if (edge.b === selected) connected.add(edge.a);
    }
  const labelIds = new Set<string>();
  const occupied: { x: number; y: number }[] = [];
  const labelCandidates = points
    .filter(
      (p) =>
        !p.item ||
        p.id === selected ||
        (selected
          ? connected.has(p.id)
          : p.depth < -30 && p.item && Math.abs(p.weight) > 1),
    )
    .sort(
      (a, b) =>
        Number(b.id === selected) - Number(a.id === selected) ||
        Number(connected.has(b.id)) - Number(connected.has(a.id)) ||
        a.depth - b.depth,
    );
  for (const p of labelCandidates) {
    if (
      p.id !== selected &&
      (p.depth > 35 ||
        occupied.some(
          (o) => Math.abs(p.x - o.x) < 70 && Math.abs(p.y - o.y) < 22,
        ))
    )
      continue;
    if (labelIds.size >= (selected ? 8 : 10) && p.id !== selected) continue;
    labelIds.add(p.id);
    occupied.push({ x: p.x, y: p.y });
  }
  const soundButton = (
    <button
      className="atlas-sound"
      aria-label={tr("Son de la carte")}
      aria-pressed={sound.enabled && !sound.unavailable}
      disabled={sound.unavailable}
      onClick={() => {
        sound.toggle();
        if (!sound.enabled) sound.play("select", true);
      }}
    >
      <span aria-hidden="true">
        {sound.enabled && !sound.unavailable ? "◖))" : "◖×"}
      </span>
      {sound.unavailable
        ? tr("Son indisponible")
        : sound.enabled
          ? tr("Son activé")
          : tr("Son désactivé")}
    </button>
  );
  return (
    <section
      className={`taste-page page-section ${phase !== "idle" ? "atlas-terminal" : "atlas-idle"}`}
      data-phase={phase}
      onClickCapture={(event) => {
        if (
          phase === "ready" &&
          (event.target as Element).closest("button,summary") &&
          !(event.target as Element).closest(".atlas-sound")
        )
          sound.play("select", true);
      }}
      onChangeCapture={() => {
        if (phase === "ready") sound.play("select", true);
      }}
      aria-label={tr("Carte de mes goûts")}
    >
      <header className="atlas-header">
        <button className="text-button settings-back" onClick={close}>
          <ArrowLeft size={20} />
          {tr("Retour aux réglages")}
        </button>
        <span className="atlas-wordmark" aria-hidden="true">
          vela<span>.</span> <small>/ NEURAL ATLAS</small>
        </span>
        {soundButton}
      </header>
      {phase === "idle" ? (
        <div className="atlas-launch">
          <div className="atlas-launch-orb" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
          </div>
          <span className="atlas-eyebrow">
            {tr("Module expérimental / 01")}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {tr("Carte de mes goûts")}
          </h1>
          <p>{tr("Vos films. Vos affinités. Une constellation à explorer.")}</p>
          <button className="button atlas-start" onClick={launch}>
            {tr("Démarrer la carte ")}
            <ArrowRight size={20} />
          </button>
          <div className="atlas-launch-stats">
            <span>
              <strong>{map.items.length}</strong> {tr(" titres personnels")}
            </span>
            <span>
              <strong>{map.edges.length}</strong> {tr(" connexions")}
            </span>
            <span>
              <strong>LOCAL</strong> {tr(" calcul sur cet appareil")}
            </span>
          </div>
          <p className="atlas-honesty">
            {tr(
              "Un décor de science-fiction, de vrais goûts. Les liens proviennent de vos titres, de leurs genres et de leurs synopsis. Aucune lecture de pensées, promis.",
            )}
          </p>
        </div>
      ) : phase === "boot" ? (
        <div className="atlas-boot">
          <div className="atlas-boot-target" aria-hidden="true">
            <i />
            <span>V</span>
          </div>
          <span className="atlas-eyebrow">
            {tr("Initialisation / Neural Atlas")}
          </span>
          <h1 ref={readyHeading} tabIndex={-1}>
            {tr("Connexion à votre univers")}
          </h1>
          <div
            className="atlas-progress"
            role="progressbar"
            aria-label={tr("Initialisation de la carte")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={(step + 1) * 25}
          >
            <i style={{ width: `${(step + 1) * 25}%` }} />
          </div>
          <div className="atlas-boot-readout">
            <span role="status">{tr(bootSteps[step])}</span>
            <strong>{String((step + 1) * 25).padStart(3, "0")}%</strong>
          </div>
          <div className="atlas-boot-log" aria-hidden="true">
            {bootSteps.map((label, i) => (
              <p key={label} className={i <= step ? "is-loaded" : ""}>
                <span>{i <= step ? "[ OK ]" : "[ -- ]"}</span> {tr(label)}
              </p>
            ))}
          </div>
          <p className="atlas-honesty">
            {tr(
              "Séquence d’ouverture visuelle · données déjà sur cet appareil.",
            )}
          </p>
          <button
            className="text-button"
            onClick={() => {
              setPhase("ready");
              sound.play("ready", true);
            }}
          >
            {tr("Passer l’intro ")}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="atlas-workspace">
          <div className="atlas-title-row">
            <div>
              <span className="atlas-eyebrow">
                {tr("Neural Atlas / exploration")}
              </span>
              <h1 ref={readyHeading} tabIndex={-1}>
                {tr("Carte de mes goûts")}
              </h1>
            </div>
            <span className="atlas-live">
              <i />
              {tr("LOCAL · ACTIF")}
            </span>
          </div>
          <div className="atlas-metrics">
            <span>
              <b>{map.shown}</b> {tr(" POINTS / ")}
              {map.items.length} {tr(" TITRES")}
            </span>
            <span>
              <b>{map.nodes.filter((n) => n.genre !== undefined).length}</b>{" "}
              {tr("GENRES")}
            </span>
            <span>
              <b>{map.edges.length}</b> {tr(" LIENS")}
            </span>
            <span>{tr("VOTRE BIBLIOTHÈQUE / VOS SIGNAUX")}</span>
          </div>
          {!map.items.length ? (
            <div className="taste-empty surface">
              <Heart size={32} />
              <h2>{tr("Votre carte commence avec vos goûts.")}</h2>
              <p className="muted">
                {tr(
                  "Notez des titres, ajoutez des coups de cœur ou remplissez votre liste « À voir » pour la découvrir.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div
                className="taste-filters"
                role="group"
                aria-label={tr("Afficher les goûts")}
              >
                {[
                  ["all", tr("Tout")],
                  ["positive", tr("Appréciés")],
                  ["watchlist", tr("À voir")],
                  ["negative", tr("Refusés")],
                  ["skip", tr("Passés")],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {tr(label)}
                  </button>
                ))}
              </div>
              <div className="taste-layout">
                <div
                  className={`taste-scene-wrap ${keyboardScene ? "has-keyboard-focus" : ""}`}
                >
                  {keyboardScene && (
                    <span className="atlas-keyboard-hint">
                      {tr("Flèches : rotation · + / − : zoom")}
                    </span>
                  )}
                  <div className="atlas-scene-grid" aria-hidden="true" />
                  <span className="atlas-scene-label" aria-hidden="true">
                    AFFINITY FIELD / 3D
                  </span>
                  <div className="taste-controls">
                    <button
                      className="icon-button"
                      aria-label={tr("Zoomer")}
                      onClick={() =>
                        move({
                          zoom: Math.min(1.8, current.current.zoom + 0.15),
                        })
                      }
                    >
                      <Plus size={20} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={tr("Dézoomer")}
                      onClick={() =>
                        move({
                          zoom: Math.max(0.6, current.current.zoom - 0.15),
                        })
                      }
                    >
                      −
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        move({ rotation: initialTasteRotation, zoom: 1 })
                      }
                    >
                      {tr("Recentrer")}
                    </button>
                  </div>
                  <svg
                    className="taste-scene"
                    viewBox="-250 -220 500 440"
                    role="img"
                    aria-label={tr(
                      "Carte interactive en trois dimensions de vos goûts",
                    )}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      setKeyboardScene(true);
                      const delta = e.shiftKey ? 25 : 10;
                      if (e.key === "ArrowLeft")
                        move({
                          rotation: rotateTasteView(
                            current.current.rotation,
                            -delta,
                            0,
                          ),
                        });
                      else if (e.key === "ArrowRight")
                        move({
                          rotation: rotateTasteView(
                            current.current.rotation,
                            delta,
                            0,
                          ),
                        });
                      else if (e.key === "ArrowUp")
                        move({
                          rotation: rotateTasteView(
                            current.current.rotation,
                            0,
                            -delta,
                          ),
                        });
                      else if (e.key === "ArrowDown")
                        move({
                          rotation: rotateTasteView(
                            current.current.rotation,
                            0,
                            delta,
                          ),
                        });
                      else if (e.key === "+" || e.key === "=")
                        move({
                          zoom: Math.min(1.8, current.current.zoom + 0.1),
                        });
                      else if (e.key === "-")
                        move({
                          zoom: Math.max(0.6, current.current.zoom - 0.1),
                        });
                      else return;
                      e.preventDefault();
                    }}
                    onFocus={(e) =>
                      setKeyboardScene(
                        e.currentTarget.matches(":focus-visible"),
                      )
                    }
                    onBlur={() => setKeyboardScene(false)}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" && e.button !== 0) return;
                      setKeyboardScene(false);
                      e.currentTarget.focus({ preventScroll: true });
                      pointers.current.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY,
                      });
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
                        )![1];
                        const before = Math.hypot(
                            old.x - other.x,
                            old.y - other.y,
                          ),
                          after = Math.hypot(
                            e.clientX - other.x,
                            e.clientY - other.y,
                          );
                        if (before > 0)
                          move({
                            zoom: Math.max(
                              0.6,
                              Math.min(
                                1.8,
                                (current.current.zoom * after) / before,
                              ),
                            ),
                          });
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const sensitivity =
                          360 / Math.min(rect.width, rect.height);
                        move({
                          rotation: rotateTasteView(
                            current.current.rotation,
                            dx * sensitivity,
                            dy * sensitivity,
                          ),
                        });
                      }
                      pointers.current.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onPointerUp={(e) => {
                      if (
                        !drag.current.multi &&
                        drag.current.distance < 6 &&
                        drag.current.id
                      ) {
                        choose(drag.current.id);
                        sound.play("select", true);
                      }
                      pointers.current.delete(e.pointerId);
                    }}
                    onPointerCancel={(e) => {
                      pointers.current.delete(e.pointerId);
                      drag.current.id = "";
                    }}
                    onLostPointerCapture={(e) =>
                      pointers.current.delete(e.pointerId)
                    }
                  >
                    <defs>
                      <radialGradient id="atlas-core">
                        <stop
                          offset="0"
                          stopColor="var(--brand)"
                          stopOpacity=".13"
                        />
                        <stop
                          offset="1"
                          stopColor="var(--brand)"
                          stopOpacity="0"
                        />
                      </radialGradient>
                    </defs>
                    <ellipse rx="230" ry="170" fill="url(#atlas-core)" />
                    <g
                      className="atlas-stardust"
                      aria-hidden="true"
                      pointerEvents="none"
                    >
                      {stardust.map((star, i) => (
                        <circle
                          key={i}
                          cx={star.x}
                          cy={star.y}
                          r={star.r}
                          opacity={i % 3 === 0 ? 0.45 : 0.2}
                        />
                      ))}
                    </g>
                    {map.edges.map((edge, i) => {
                      const a = byId.get(edge.a)!,
                        b = byId.get(edge.b)!;
                      if (
                        (a.item && !visible.has(a.id)) ||
                        (b.item && !visible.has(b.id))
                      )
                        return null;
                      const active = selected === a.id || selected === b.id;
                      return (
                        <line
                          key={i}
                          x1={a.x}
                          y1={a.y}
                          x2={b.x}
                          y2={b.y}
                          className={`taste-edge ${active ? "is-selected" : ""} ${edge.kind}`}
                          strokeOpacity={
                            active
                              ? 0.68 * Math.max(a.opacity, b.opacity) + 0.2
                              : (selected
                                  ? 0.08
                                  : edge.kind === "genre"
                                    ? 0.28
                                    : 0.36) * Math.min(a.opacity, b.opacity)
                          }
                        />
                      );
                    })}
                    {points
                      .sort((a, b) => b.depth - a.depth)
                      .map((point) => {
                        if (point.item && !visible.has(point.id)) return null;
                        const active = selected === point.id,
                          r = point.item
                            ? (1.8 +
                                Math.min(1.7, Math.abs(point.weight) * 0.23)) *
                              point.scale
                            : (3.5 +
                                Math.min(1, Math.abs(point.weight) * 0.15)) *
                              point.scale;
                        return (
                          <g
                            key={point.id}
                            data-taste-id={point.id}
                            className={`taste-point ${point.item?.kind || "anchor"} ${active ? "is-selected" : ""}`}
                            data-depth={point.depth.toFixed(2)}
                            opacity={
                              active
                                ? 1
                                : point.opacity *
                                  (selected && !connected.has(point.id)
                                    ? 0.55
                                    : 1)
                            }
                          >
                            <title>
                              {point.genre !== undefined
                                ? tr(point.label)
                                : point.label}
                              {point.item
                                ? ` · ${tr(labels[point.item.kind])}`
                                : ""}
                            </title>
                            {point.item && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={Math.max(13, r)}
                                fill="transparent"
                                stroke="none"
                              />
                            )}
                            {active && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={r + 6}
                                className="taste-selection"
                              />
                            )}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={r * 3.2}
                              className="taste-star-halo"
                            />
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={r}
                              className="taste-star-core"
                            />
                            {point.item &&
                              point.depth < 0 &&
                              Math.abs(point.weight) > 2 && (
                                <path
                                  className="taste-star-rays"
                                  d={`M${point.x - r * 2.4},${point.y}h${r * 4.8} M${point.x},${point.y - r * 2.4}v${r * 4.8}`}
                                />
                              )}
                            {labelIds.has(point.id) && (
                              <text
                                x={point.x}
                                y={point.y - r - 8}
                                textAnchor="middle"
                              >
                                {pointLabel(point).length > 26
                                  ? `${pointLabel(point).slice(0, 25)}…`
                                  : pointLabel(point)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                  </svg>
                  <p className="muted fine taste-instructions">
                    {tr(
                      "Glissez pour tourner · Pincez ou utilisez + / − pour zoomer · Cliquez sur une étoile.",
                    )}
                  </p>
                  <div className="taste-legend">
                    {["positive", "watchlist", "negative", "skip"].map(
                      (kind) => (
                        <span key={kind}>
                          <i className={kind} />
                          {tr(labels[kind as TasteItem["kind"]])}
                        </span>
                      ),
                    )}
                  </div>
                </div>
                <aside
                  className="taste-inspector surface"
                  data-heading={tr("CONNEXIONS / SIGNAL")}
                  aria-label={tr("Détails du point sélectionné")}
                >
                  <label className="field">
                    {tr("Rechercher un titre")}
                    <div className="taste-search">
                      <Search size={18} />
                      <input
                        aria-label={tr("Rechercher un titre")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tr("Un film, une série…")}
                      />
                    </div>
                  </label>
                  <label className="field">
                    {tr("Choisir un point")}
                    <select
                      aria-label={tr("Choisir un point")}
                      value={
                        chosenGenre ||
                        visibleItems.some((item) => item.id === selected)
                          ? selected
                          : ""
                      }
                      onChange={(e) => choose(e.target.value)}
                    >
                      <option value="">
                        {visibleItems.length} {tr("titre")}
                        {visibleItems.length > 1 ? "s" : ""}
                      </option>
                      <optgroup label={tr("Genres")}>
                        {map.nodes
                          .filter((node) => node.genre !== undefined)
                          .map((node) => (
                            <option key={node.id} value={node.id}>
                              {tr(node.label)}
                            </option>
                          ))}
                      </optgroup>
                      {visibleItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {chosen ? (
                    <>
                      <span className={`taste-status ${chosen.kind}`}>
                        {tr(labels[chosen.kind])}
                      </span>
                      <h2>{chosen.title.name}</h2>
                      <p className="muted">
                        {chosen.title.year} ·{" "}
                        {chosen.title.genres.map((g) => tr(g)).join(" / ") ||
                          tr("Genre non renseigné")}
                      </p>
                      {chosen.rating > 0 && (
                        <p>
                          {tr("Votre note : ")}
                          {chosen.rating}/5
                        </p>
                      )}
                      {chosen.favorite && (
                        <p className="taste-favorite">
                          <Heart size={16} />
                          {tr("Coup de cœur")}
                        </p>
                      )}
                      <p className="muted">
                        {chosen.kind === "skip"
                          ? tr(
                              "Un signal faible et temporaire. Passer rapidement un titre pèse beaucoup moins qu’un refus explicite.",
                            )
                          : chosen.kind === "watchlist"
                            ? tr(
                                "Une envie de découverte. Ce titre ne compte pas comme un film déjà aimé.",
                              )
                            : chosen.kind === "negative"
                              ? tr(
                                  "Ce signal réduit la priorité des recommandations semblables.",
                                )
                              : chosen.kind === "positive"
                                ? tr(
                                    "Ce titre aide à trouver d’autres films proches. Plusieurs favoris d’une même famille sont équilibrés pour garder de la variété.",
                                  )
                                : tr(
                                    "Un visionnage sans note donne peu d’indications sur vos préférences.",
                                  )}
                      </p>
                      {map.neighbours.get(chosen.id)?.length ? (
                        <div className="taste-neighbours">
                          <h3>{tr("Liens proches")}</h3>
                          {map.neighbours.get(chosen.id)!.map((neighbour) => (
                            <button
                              className="text-button"
                              key={neighbour.id}
                              onClick={() => choose(neighbour.id)}
                            >
                              {
                                map.items.find(
                                  (item) => item.id === neighbour.id,
                                )?.title.name
                              }
                              <ArrowRight size={15} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <button
                        className="button tonal"
                        onClick={() => open(chosen.title)}
                      >
                        {tr("Ouvrir la fiche")}
                        <ArrowRight size={18} />
                      </button>
                    </>
                  ) : chosenGenre ? (
                    <>
                      <span
                        className={`taste-status ${chosenGenre.weight < 0 ? "negative" : ""}`}
                      >
                        {tr("Genre ·")}{" "}
                        {chosenGenre.weight > 0.2
                          ? tr("Affinité positive")
                          : chosenGenre.weight < -0.2
                            ? tr("Affinité négative")
                            : tr("Signaux légers ou partagés")}
                      </span>
                      <h2>{tr(chosenGenre.label)}</h2>
                      <p className="muted">
                        {tr(
                          "Ce repère relie vos titres de ce genre. Son affinité résume vos notes, coups de cœur et envies, en équilibrant les familles de films.",
                        )}
                      </p>
                      <div className="taste-neighbours">
                        <h3>{tr("Titres liés")}</h3>
                        {map.items
                          .filter((item) =>
                            item.genres.length
                              ? item.genres.includes(chosenGenre.genre!)
                              : chosenGenre.genre === 0,
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <button
                              key={item.id}
                              className="text-button"
                              onClick={() => choose(item.id)}
                            >
                              {item.title.name}
                              <ArrowRight size={15} />
                            </button>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="taste-select-hint">
                      <Bookmark size={28} />
                      <p className="muted">
                        {tr(
                          "Choisissez un point ou un titre pour voir son rôle dans vos recommandations.",
                        )}
                      </p>
                    </div>
                  )}
                </aside>
              </div>
              <details className="taste-explanation">
                <summary>{tr("Comment lire cette carte ?")}</summary>
                <p className="muted">
                  {tr(
                    "Les repères représentent les genres de vos titres. Les points sont rapprochés par leurs genres et les mots de leurs synopsis, comme dans le classement local. Un lien entre deux titres indique une similarité, pas une recommandation garantie. La taille des points reflète la force du signal ; la couleur indique son sens. Les points à l’arrière sont atténués ; les titres sélectionnés et leurs connexions sont mis en évidence. Les petites poussières du fond sont décoratives.",
                  )}
                </p>
                <p className="muted">
                  {tr(
                    "La disposition est une projection en 3D pour explorer les goûts : les distances n’expriment ni un pourcentage de compatibilité ni l’ensemble des paramètres du moteur. Vos anciens favoris restent conservés.",
                  )}
                </p>
                {map.items.length > map.shown && (
                  <p className="muted">
                    {map.shown} {tr(" points représentatifs sur ")}
                    {map.items.length}{" "}
                    {tr(
                      "titres sont affichés pour garder la carte fluide. La recherche permet de consulter les autres titres.",
                    )}
                  </p>
                )}
              </details>
            </>
          )}
          <footer className="atlas-footer">
            <span>VELA / NEURAL ATLAS</span>
            <span>{tr("Genres + synopsis · distances illustratives")}</span>
            <span>{tr("Aucun serveur de calcul")}</span>
          </footer>
        </div>
      )}
    </section>
  );
}

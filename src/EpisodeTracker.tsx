import { useEffect, useRef, useState } from "react";
import {
  episodes,
  isTmdb,
  seasonEpisodes,
  type Episode,
  type Season,
  type Title,
} from "./catalog";
import type { Entry } from "./store";
export default function EpisodeTracker({
  title,
  entry,
  update,
}: {
  title: Title;
  entry: Entry;
  update: (patch: Partial<Entry>) => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>(title.seasons || []),
    [loaded, setLoaded] = useState<Record<number, Episode[]>>({}),
    [states, setStates] = useState<
      Record<number, "loading" | "ready" | "error">
    >({}),
    [legacyState, setLegacyState] = useState("");
  const controllers = useRef<AbortController[]>([]);
  const pending = useRef(new Set<number>());
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    controllers.current.push(c);
    if (!isTmdb(title)) {
      setLegacyState("loading");
      episodes(title.id, c.signal)
        .then((data) => {
          if (!active) return;
          const nums = [...new Set(data.map((e) => e.season))];
          setSeasons(
            nums.map((n) => ({
              number: n,
              name: `Saison ${n}`,
              count: data.filter((e) => e.season === n).length,
            })),
          );
          setLoaded(
            Object.fromEntries(
              nums.map((n) => [n, data.filter((e) => e.season === n)]),
            ),
          );
          setLegacyState("ready");
        })
        .catch(() => {
          if (active) setLegacyState("error");
        });
    }
    return () => {
      active = false;
      controllers.current.forEach((c) => c.abort());
    };
  }, [title.id]);
  async function load(season: number) {
    if (loaded[season] || pending.current.has(season)) return;
    pending.current.add(season);
    const c = new AbortController();
    controllers.current.push(c);
    setStates((s) => ({ ...s, [season]: "loading" }));
    try {
      const data = await seasonEpisodes(title, season, c.signal);
      if (!c.signal.aborted) {
        setLoaded((s) => ({ ...s, [season]: data }));
        setStates((s) => ({ ...s, [season]: "ready" }));
      }
    } catch {
      if (!c.signal.aborted) setStates((s) => ({ ...s, [season]: "error" }));
    } finally {
      pending.current.delete(season);
    }
  }
  const total = seasons.reduce((n, s) => n + s.count, 0);
  return (
    <section className="episodes">
      <h3>
        Votre progression{" "}
        <span>
          {entry.episodes.length} / {total} épisodes
        </span>
      </h3>
      {legacyState === "loading" && (
        <p className="muted">Chargement des épisodes…</p>
      )}
      {legacyState === "error" && (
        <p className="error">Les épisodes sont indisponibles pour le moment.</p>
      )}
      {!seasons.length &&
        legacyState !== "loading" &&
        legacyState !== "error" && (
          <p className="muted">Aucun épisode répertorié.</p>
        )}
      {seasons.map((season) => (
        <details
          key={season.number}
          onToggle={(e) => {
            if (e.currentTarget.open && isTmdb(title)) load(season.number);
          }}
        >
          <summary>
            {season.name}
            <span>
              {loaded[season.number]
                ? loaded[season.number].filter((e) =>
                    entry.episodes.includes(e.id),
                  ).length
                : "—"}{" "}
              / {season.count}
            </span>
          </summary>
          {states[season.number] === "loading" && (
            <p className="muted">Chargement de la saison…</p>
          )}
          {states[season.number] === "error" && (
            <div className="error">
              Cette saison n’a pas pu être chargée.
              <button onClick={() => load(season.number)}>
                Réessayer la saison
              </button>
            </div>
          )}
          {loaded[season.number]?.map((ep) => (
            <label className="episode" key={ep.id}>
              <input
                type="checkbox"
                checked={entry.episodes.includes(ep.id)}
                onChange={() =>
                  update({
                    episodes: entry.episodes.includes(ep.id)
                      ? entry.episodes.filter((id) => id !== ep.id)
                      : [...entry.episodes, ep.id],
                  })
                }
              />
              <span>E{String(ep.number || 0).padStart(2, "0")}</span>
              {ep.name}
            </label>
          ))}
        </details>
      ))}
    </section>
  );
}

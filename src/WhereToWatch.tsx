import { useEffect, useState } from "react";
import { watchOffers, offerKinds, type WatchOffers } from "./watch-providers";
import { countries, type ViewingPreferences } from "./viewing-preferences";
import type { Title } from "./catalog";
import {
  directWatchLinks,
  providerDirectLink,
  type DirectWatchLink,
} from "./direct-watch-links";
export default function WhereToWatch({
  title,
  preferences,
  settings,
  ready = true,
}: {
  title: Title;
  preferences: ViewingPreferences;
  settings: () => void;
  ready?: boolean;
}) {
  const [data, setData] = useState<WatchOffers | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const [links, setLinks] = useState<DirectWatchLink[]>([]),
    [linkStatus, setLinkStatus] = useState("loading");
  useEffect(() => {
    const c = new AbortController();
    setLinks([]);
    setLinkStatus("loading");
    if (!preferences.country || !ready) return () => c.abort();
    directWatchLinks(title, c.signal)
      .then((v) => {
        if (!c.signal.aborted) {
          setLinks(v);
          setLinkStatus("ready");
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setLinkStatus("error");
      });
    return () => c.abort();
  }, [title.id, title.imdbUrl, preferences.country, retry, ready]);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    if (!preferences.country) return;
    setLoading(true);
    watchOffers(title, preferences.country, c.signal)
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [title.id, preferences.country, retry]);
  const labels = {
    flatrate: "Avec abonnement",
    free: "Gratuit",
    ads: "Gratuit avec publicité",
    rent: "À louer",
    buy: "À acheter",
  };
  return (
    <section className="where-to-watch" aria-label="Où regarder">
      <div className="section-heading">
        <h3>Où regarder</h3>
        <button className="text-button" onClick={settings}>
          {countries.find((c) => c.code === preferences.country)?.name ||
            "Choisir mon pays"}{" "}
          · Modifier
        </button>
      </div>
      {!preferences.country ? (
        <p className="muted">
          Choisissez votre pays pour voir les plateformes disponibles.
        </p>
      ) : (
        <>
          {loading && (
            <p className="muted" role="status">
              Recherche des disponibilités…
            </p>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => setRetry((n) => n + 1)}>
                Réessayer les disponibilités
              </button>
            </div>
          )}
          {data && (
            <>
              {offerKinds.every((kind) => !data[kind].length) && (
                <p className="muted">
                  Aucune offre renseignée pour ce titre dans votre pays. Cela ne
                  signifie pas forcément qu’il est indisponible.
                </p>
              )}
              {offerKinds.map((kind) =>
                data[kind].length ? (
                  <div className="watch-group" key={kind}>
                    <h4>{labels[kind]}</h4>
                    <div className="watch-provider-list">
                      {[...data[kind]]
                        .sort(
                          (a, b) =>
                            Number(preferences.providers.includes(b.id)) -
                            Number(preferences.providers.includes(a.id)),
                        )
                        .map((p) => (
                          <div
                            className={
                              "watch-provider" +
                              (preferences.providers.includes(p.id)
                                ? " is-subscribed"
                                : "")
                            }
                            key={p.id}
                          >
                            {p.logo && (
                              <img src={p.logo} alt="" loading="lazy" />
                            )}
                            <span>
                              {p.name}
                              {preferences.providers.includes(p.id) && (
                                <small>Mon service</small>
                              )}
                            </span>
                            {providerDirectLink(p.name, links) ? (
                              <a
                                className="text-button"
                                href={providerDirectLink(p.name, links)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ouvrir le titre ↗
                              </a>
                            ) : (
                              <small className="muted">
                                {linkStatus === "loading"
                                  ? "Recherche du lien…"
                                  : linkStatus === "error"
                                    ? "Lien direct momentanément indisponible"
                                    : "Lien direct non renseigné"}
                              </small>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null,
              )}
              {linkStatus === "error" && (
                <button
                  className="text-button"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Réessayer les liens de lecture
                </button>
              )}
              <p className="muted fine">
                Disponibilités fournies par{" "}
                <a
                  href="https://www.justwatch.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  JustWatch
                </a>{" "}
                via TMDB. Liens directs issus de Wikidata lorsqu’ils sont
                renseignés. La lecture se fait chez le service concerné ; une
                location ou un achat peut être payant.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

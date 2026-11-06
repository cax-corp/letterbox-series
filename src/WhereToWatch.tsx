import { useEffect, useState } from "react";
import {
  watchOffers,
  type Provider,
  type WatchOffers,
} from "./watch-providers";
import { countries, type ViewingPreferences } from "./viewing-preferences";
import type { Title } from "./catalog";
import { ChevronRight } from "./icons";

function ProviderIcons({
  providers,
  limit,
}: {
  providers: Provider[];
  limit?: number;
}) {
  const shown = limit ? providers.slice(0, limit) : providers;
  return (
    <span className="provider-icon-row">
      {shown.map((p) => (
        <span
          className="provider-icon"
          key={p.id}
          role="img"
          aria-label={p.name}
          title={p.name}
        >
          {p.logo ? (
            <img src={p.logo} alt="" loading="lazy" />
          ) : (
            <span aria-hidden="true">{p.name.slice(0, 1)}</span>
          )}
        </span>
      ))}
      {limit && providers.length > limit && (
        <span
          className="provider-overflow"
          aria-label={`${providers.length - limit} autres services`}
        >
          +{providers.length - limit}
        </span>
      )}
    </span>
  );
}
export default function WhereToWatch({
  title,
  preferences,
  settings,
}: {
  title: Title;
  preferences: ViewingPreferences;
  settings: () => void;
}) {
  const [data, setData] = useState<WatchOffers | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    if (!preferences.country || !preferences.providers.length) return;
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
  }, [
    title.id,
    preferences.country,
    Boolean(preferences.providers.length),
    retry,
  ]);
  const own = (list: Provider[]) =>
    list.filter((p) => preferences.providers.includes(p.id));
  const streaming = data
    ? [
        ...new Map(
          [...data.flatrate, ...data.free, ...data.ads]
            .filter((p) => preferences.providers.includes(p.id))
            .map((p) => [p.id, p]),
        ).values(),
      ]
    : [];
  const rows = data
    ? ([
        ["Abonnement", own(data.flatrate)],
        ["Gratuit", own(data.free)],
        ["Avec publicité", own(data.ads)],
        ["À l’achat", own(data.buy)],
        ["À la location", own(data.rent)],
      ] as const)
    : [];
  const paid = data
    ? [
        ...new Map(
          [...own(data.buy), ...own(data.rent)].map((p) => [p.id, p]),
        ).values(),
      ]
    : [];
  const preview = streaming.length ? streaming : paid;
  return (
    <section className="where-to-watch" aria-label="Où regarder">
      {!preferences.country ? (
        <button className="availability-prompt" onClick={settings}>
          Disponible sur{" "}
          <span>
            Choisir mon pays <ChevronRight size={16} />
          </span>
        </button>
      ) : !preferences.providers.length ? (
        <button className="availability-prompt" onClick={settings}>
          Disponible sur{" "}
          <span>
            Choisir mes services <ChevronRight size={16} />
          </span>
        </button>
      ) : loading ? (
        <p className="availability-status muted" role="status">
          Recherche des disponibilités…
        </p>
      ) : error ? (
        <div className="availability-error" role="alert">
          <span>Disponibilités indisponibles</span>
          <button
            className="text-button"
            title={error}
            onClick={() => setRetry((n) => n + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : data ? (
        <details className="availability-fold">
          <summary>
            <span className="availability-label">
              {!streaming.length && paid.length
                ? "Location / achat"
                : "Disponible sur"}
            </span>
            {preview.length ? (
              <ProviderIcons providers={preview} limit={4} />
            ) : (
              <span className="availability-empty muted">
                Aucun de mes services
              </span>
            )}
            <ChevronRight className="disclosure-chevron" size={18} />
          </summary>
          <div className="availability-content">
            {rows
              .filter(([, list]) => list.length > 0)
              .map(([label, list]) => (
                <div className="availability-offer-row" key={label}>
                  <span>{label}</span>
                  <ProviderIcons providers={list} />
                </div>
              ))}
            {!rows.some(([, list]) => list.length > 0) && (
              <p className="muted fine">
                Aucune offre renseignée pour vos services dans ce pays.
              </p>
            )}
            <div className="availability-footer">
              <span>
                {countries.find((c) => c.code === preferences.country)?.name} ·{" "}
                <a
                  href="https://www.justwatch.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  JustWatch
                </a>{" "}
                / TMDB
              </span>
              <button className="text-button" onClick={settings}>
                Modifier mes services
              </button>
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}

import { t as tr, useLanguage } from "./i18n";
import { useEffect, useState } from "react";
import {
  localizedCountries,
  type ViewingPreferences,
} from "./viewing-preferences";
import { providerCatalog, type Provider } from "./watch-providers";
export function CountrySelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  useLanguage();
  return (
    <label className="field">
      {tr("Pays de résidence")}
      <select
        aria-label={tr("Pays de résidence")}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{tr("Choisir un pays")}</option>
        {localizedCountries().map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function ViewingSettings({
  value,
  save,
  message,
}: {
  value: ViewingPreferences;
  save: (country: string, providers: number[]) => void;
  message: string;
}) {
  const language = useLanguage();
  const [providers, setProviders] = useState<Provider[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [all, setAll] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setProviders([]);
    setError("");
    setQuery("");
    setAll(false);
    if (!value.country) return;
    setLoading(true);
    providerCatalog(value.country, c.signal)
      .then((p) => {
        if (!c.signal.aborted) setProviders(p);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [value.country, retry, language]);
  const shown = providers
    .filter((p) =>
      p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(value.providers.includes(b.id)) -
        Number(value.providers.includes(a.id)),
    );
  return (
    <section className="viewing-settings" aria-label={tr("Pays et services")}>
      <h2>{tr("Pays et services")}</h2>
      <p className="muted">
        {tr(
          "Les disponibilités dépendent de votre pays. Choisissez vos services pour les retrouver en premier sur les fiches.",
        )}
      </p>
      <CountrySelect
        value={value.country}
        onChange={(country) => save(country, [])}
      />
      {value.country && (
        <>
          <label className="field">
            {tr("Rechercher un service")}
            <input
              type="search"
              placeholder="Netflix, Prime Video, Disney+…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {loading && (
            <p role="status" className="muted">
              {tr("Chargement des services…")}
            </p>
          )}
          {error && (
            <div role="alert" className="error">
              {tr(error)}
              <button onClick={() => setRetry((n) => n + 1)}>
                {tr("Réessayer les services")}
              </button>
            </div>
          )}
          <fieldset className="provider-choices">
            <legend>
              {tr("Mes services (")}
              {value.providers.length})
            </legend>
            {shown.slice(0, all || query ? undefined : 12).map((p) => (
              <label key={p.id} className="provider-choice">
                <input
                  type="checkbox"
                  checked={value.providers.includes(p.id)}
                  onChange={() =>
                    save(
                      value.country,
                      value.providers.includes(p.id)
                        ? value.providers.filter((id) => id !== p.id)
                        : [...value.providers, p.id],
                    )
                  }
                />
                {p.logo && <img src={p.logo} alt="" loading="lazy" />}
                <span>{p.name}</span>
              </label>
            ))}
          </fieldset>
          {!loading && !error && !shown.length && (
            <p className="muted">{tr("Aucun service trouvé.")}</p>
          )}
          {!all && !query && shown.length > 12 && (
            <button className="text-button" onClick={() => setAll(true)}>
              {tr("Afficher tous les services (")}
              {shown.length})
            </button>
          )}
          <p className="muted fine">
            {tr(
              "Sélectionnez votre formule exacte si plusieurs offres portent le même nom. Les services choisis ne garantissent pas que tous leurs titres soient inclus.",
            )}
          </p>
        </>
      )}
      {message && (
        <p className="muted fine" role="status">
          {tr(message)}
        </p>
      )}
    </section>
  );
}

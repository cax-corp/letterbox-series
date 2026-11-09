import { t as tr } from "./i18n";
import {
  discoveryGenres,
  type useDiscoveryPreferences,
} from "./discovery-preferences";
export default function DiscoverySettings({
  preferences,
}: {
  preferences: ReturnType<typeof useDiscoveryPreferences>;
}) {
  const { value, change } = preferences;
  return (
    <section
      className="discovery-settings"
      aria-label={tr("Recommandations et spoilers")}
    >
      <h2>{tr("Recommandations et spoilers")}</h2>
      <p className="muted">
        {tr(
          "Les exclusions s’appliquent à vos recommandations et à l’accueil. Vos recherches et votre collection restent accessibles.",
        )}
      </p>
      <details className="detail-disclosure">
        <summary>
          {tr("Genres exclus")} <span>{value.genres.length}</span>
        </summary>
        <div className="genre-exclusions">
          {discoveryGenres.map((g) => (
            <label key={g.id}>
              <input
                type="checkbox"
                checked={value.genres.includes(g.id)}
                onChange={() =>
                  change({
                    genres: value.genres.includes(g.id)
                      ? value.genres.filter((id) => id !== g.id)
                      : [...value.genres, g.id],
                  })
                }
              />
              {tr(g.name)}
            </label>
          ))}
        </div>
      </details>
      <h3>{tr("Sagas exclues")}</h3>
      {!value.sagas.length ? (
        <p className="fine muted">
          {tr(
            "Vous pouvez exclure une saga depuis la fiche d’un de ses films.",
          )}
        </p>
      ) : (
        <div className="excluded-sagas">
          {value.sagas.map((s) => (
            <div key={s.id}>
              <span>{s.name}</span>
              <button
                className="text-button"
                onClick={() =>
                  change({ sagas: value.sagas.filter((x) => x.id !== s.id) })
                }
              >
                {tr("Réautoriser")}
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="preference-toggle">
        <input
          type="checkbox"
          checked={value.protectSpoilers}
          onChange={(e) => change({ protectSpoilers: e.target.checked })}
        />
        <span>{tr("Masquer les avis contenant des spoilers")}</span>
      </label>
      <p className="fine muted">
        {tr(
          "Un bouton permet de révéler chaque avis. Ce choix est lié à votre compte.",
        )}
      </p>
      {preferences.error && (
        <p className="error" role="status">
          {preferences.error}
        </p>
      )}
    </section>
  );
}

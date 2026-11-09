import { useMemo, useState } from "react";
import { t as tr, getLanguage } from "./i18n";
import type { Library } from "./store";
import type { Title } from "./catalog";
import { monthKey, monthlyReport, shiftMonth } from "./monthly-report";
import { ArrowLeft, ArrowRight, Film, Star } from "./icons";
export default function MonthlyReport({
  library,
  close,
  open,
}: {
  library: Library;
  close: () => void;
  open: (title: Title) => void;
}) {
  const [month, setMonth] = useState(monthKey()),
    report = useMemo(() => monthlyReport(library, month), [library, month]),
    [y, m] = month.split("-").map(Number);
  return (
    <section
      className="monthly-report page-section"
      aria-label={tr("Bilan mensuel")}
    >
      <button className="text-button settings-back" onClick={close}>
        <ArrowLeft size={20} />
        {tr("Retour au profil")}
      </button>
      <h1>{tr("Votre mois de cinéma")}</h1>
      <div className="month-selector">
        <button
          className="icon-button"
          aria-label={tr("Mois précédent")}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ArrowLeft size={22} />
        </button>
        <label>
          <span className="sr-only">{tr("Mois du bilan")}</span>
          <input
            type="month"
            value={month}
            max={monthKey()}
            min="1900-01"
            onChange={(e) => {
              if (
                /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                e.target.value <= monthKey()
              )
                setMonth(e.target.value);
            }}
          />
        </label>
        <button
          className="icon-button"
          disabled={month >= monthKey()}
          aria-label={tr("Mois suivant")}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ArrowRight size={22} />
        </button>
      </div>
      <h2>
        {new Date(y, m - 1, 1).toLocaleDateString(getLanguage(), {
          month: "long",
          year: "numeric",
        })}
      </h2>
      <div className="stats monthly-stats">
        {[
          [report.movies, tr("Films vus")],
          [report.series, tr("Séries vues")],
          [
            report.average === null
              ? "—"
              : `${report.average.toLocaleString(getLanguage(), { maximumFractionDigits: 1 })}/5`,
            tr("Note moyenne"),
          ],
          [report.activeDays, tr("Jours actifs")],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        {tr(
          "{0} titres le mois précédent · {1} coups de cœur ce mois-ci",
          report.previousCount,
          report.favorites,
        )}
      </p>
      {!report.entries.length ? (
        <div className="monthly-empty surface">
          <Film size={32} />
          <p>{tr("Aucun visionnage enregistré pour ce mois.")}</p>
          <p className="fine muted">
            {tr(
              "Les titres marqués vus apparaissent ici selon leur date de visionnage.",
            )}
          </p>
        </div>
      ) : (
        <>
          <h2>{tr("Vos genres du mois")}</h2>
          <div className="monthly-genres">
            {report.genres.map(([genre, count]) => (
              <div key={genre}>
                <span>{tr(genre)}</span>
                <span className="monthly-bar">
                  <i
                    style={{
                      width: `${(100 * count) / Math.max(1, report.genres[0][1])}%`,
                    }}
                  />
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {report.highlights.length > 0 && (
            <>
              <h2>{tr("Vos mieux notés")}</h2>
              <div className="monthly-highlights">
                {report.highlights.map((e) => (
                  <button key={e.title.id} onClick={() => open(e.title)}>
                    {e.title.image ? (
                      <img src={e.title.image} alt="" loading="lazy" />
                    ) : (
                      <Film size={30} />
                    )}
                    <strong>{e.title.name}</strong>
                    <span>
                      <Star size={15} />
                      {e.rating}/5
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <p className="fine muted">
        {tr(
          "Bilan calculé sur cet appareil à partir de votre collection. Une série compte pour un titre ; seuls les titres de ce mois entrent dans la moyenne.",
        )}
      </p>
    </section>
  );
}

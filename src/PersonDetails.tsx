import { useEffect, useState, type ReactNode } from "react";
import {
  getPersonDetails,
  type Person,
  type PersonDetails,
  type Title,
} from "./catalog";
import { t as tr, useLanguage } from "./i18n";
import { User } from "./icons";
import Modal from "./Modal";

export function PersonPortrait({
  person,
  alt = "",
}: {
  person: Person;
  alt?: string;
}) {
  return (
    <span className="cast-portrait">
      <User size={32} />
      {person.image && (
        <img
          src={person.image}
          alt={alt}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

export default function PersonDetailsDialog({
  person,
  close,
  renderTitle,
}: {
  person: Person;
  close: () => void;
  renderTitle: (title: Title, index: number) => ReactNode;
}) {
  const language = useLanguage();
  const [details, setDetails] = useState<PersonDetails>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDetails(undefined);
    setFailed(false);
    getPersonDetails(person.id, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setDetails(data);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [person.id, language, attempt]);

  return (
    <Modal
      label={person.name}
      close={close}
      wide
      overlayClassName="person-overlay"
    >
      <div className="person-details">
        <header className="person-heading">
          <PersonPortrait person={details?.image ? details : person} />
          <div>
            <h2>{details?.name || person.name}</h2>
            <a
              className="text-button"
              href={`https://www.themoviedb.org/person/${person.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {tr("Fiche TMDB")}
            </a>
          </div>
        </header>
        {failed ? (
          <div className="error" role="alert">
            {tr("Fiche indisponible.")}
            <button onClick={() => setAttempt((count) => count + 1)}>
              {tr("Réessayer")}
            </button>
          </div>
        ) : details ? (
          <>
            {details.biography && (
              <p className="person-biography">{details.biography}</p>
            )}
            {(
              [
                [tr("Interprétation"), details.acting],
                [tr("Réalisation"), details.directing],
              ] as const
            ).map(
              ([label, titles]) =>
                titles.length > 0 && (
                  <section key={label}>
                    <h3>{label}</h3>
                    <div className="poster-grid search-grid">
                      {titles.map(renderTitle)}
                    </div>
                  </section>
                ),
            )}
            {!details.acting.length && !details.directing.length && (
              <p>{tr("Aucune filmographie disponible.")}</p>
            )}
          </>
        ) : (
          <p role="status">{tr("Chargement…")}</p>
        )}
      </div>
    </Modal>
  );
}

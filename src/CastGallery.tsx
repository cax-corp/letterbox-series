import { t as tr } from "./i18n";
import { useState } from "react";
import { PersonPortrait } from "./PersonDetails";
import type { Person } from "./catalog";
import { User, ChevronRight } from "./icons";
export default function CastGallery({
  cast,
  directors = false,
  openPerson,
}: {
  cast?: (Person & { character?: string })[];
  directors?: boolean;
  openPerson: (person: Person) => void;
}) {
  const [open, setOpen] = useState(false),
    [all, setAll] = useState(false);
  if (!cast?.length) return null;
  return (
    <details
      className="cast-gallery detail-disclosure"
      aria-label={directors ? tr("Réalisation") : tr("Distribution")}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (!e.currentTarget.open) setAll(false);
      }}
    >
      <summary>
        <span>
          <User size={18} />{" "}
          {directors ? tr(" Voir la réalisation ") : tr(" Voir les acteurs ")}
          <small>{cast.length}</small>
        </span>
        <ChevronRight className="disclosure-chevron" size={18} />
      </summary>
      {open && (
        <div className="cast-content">
          <div className="cast-grid">
            {cast.slice(0, all ? undefined : 6).map((p) => (
              <button
                className="cast-person"
                key={p.id}
                onClick={() => openPerson(p)}
              >
                <PersonPortrait person={p} alt={p.name} />
                <strong>{p.name}</strong>
                {p.character && <small>{p.character}</small>}
              </button>
            ))}
          </div>
          {!all && cast.length > 6 && (
            <button className="text-button" onClick={() => setAll(true)}>
              {directors
                ? tr("Voir plus de réalisateurs (")
                : tr("Voir plus d’interprètes (")}
              {cast.length})
            </button>
          )}
        </div>
      )}
    </details>
  );
}

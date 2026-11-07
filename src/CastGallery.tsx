import { t as tr } from "./i18n";
import { useState } from "react";
import type { CastMember } from "./catalog";
import { User, ChevronRight } from "./icons";
export default function CastGallery({ cast }: { cast?: CastMember[] }) {
  const [open, setOpen] = useState(false),
    [all, setAll] = useState(false);
  if (!cast?.length) return null;
  return (
    <details
      className="cast-gallery detail-disclosure"
      aria-label={tr("Distribution")}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (!e.currentTarget.open) setAll(false);
      }}
    >
      <summary>
        <span>
          <User size={18} /> {tr(" Voir les acteurs ")}
          <small>{cast.length}</small>
        </span>
        <ChevronRight className="disclosure-chevron" size={18} />
      </summary>
      {open && (
        <div className="cast-content">
          <div className="cast-grid">
            {cast.slice(0, all ? undefined : 6).map((p) => (
              <a
                className="cast-person"
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="cast-portrait">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <User size={32} />
                  )}
                </span>
                <strong>{p.name}</strong>
                {p.character && <small>{p.character}</small>}
              </a>
            ))}
          </div>
          {!all && cast.length > 6 && (
            <button className="text-button" onClick={() => setAll(true)}>
              {tr("Voir plus d’interprètes (")}
              {cast.length})
            </button>
          )}
        </div>
      )}
    </details>
  );
}

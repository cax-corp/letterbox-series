import { useState } from "react";
import type { CastMember } from "./catalog";
import { User } from "./icons";
export default function CastGallery({ cast }: { cast?: CastMember[] }) {
  const [all, setAll] = useState(false);
  if (!cast?.length) return null;
  return (
    <section className="cast-gallery" aria-label="Distribution">
      <h3>Distribution</h3>
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
                <User size={36} />
              )}
            </span>
            <strong>{p.name}</strong>
            {p.character && <small>{p.character}</small>}
          </a>
        ))}
      </div>
      {!all && cast.length > 6 && (
        <button className="text-button" onClick={() => setAll(true)}>
          Voir toute la distribution ({cast.length})
        </button>
      )}
    </section>
  );
}

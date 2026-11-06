import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import type { Profile } from "./profile";
import { profileStats } from "./profile-stats";
import { profileShare, reviewShare, type ShareDraft } from "./sharing";
import type { Library } from "./store";
import type { Title } from "./catalog";
import { ShareIcon, Star, Film, Plus } from "./icons";
export default function ProfileOverview({
  profile,
  library,
  email,
  edit,
  open,
  toast,
  pending,
  share,
}: {
  profile: Profile;
  library: Library;
  email?: string;
  edit: () => void;
  open: (t: Title) => void;
  toast: (s: string) => void;
  pending: boolean;
  share: (draft: ShareDraft) => void;
}) {
  const stats = useMemo(() => profileStats(library), [library]),
    [reviewLimit, setReviewLimit] = useState(3);
  const name =
    profile.displayName ||
    email?.split("@")[0] ||
    "Le premier rôle, c’est vous.";
  const reviews = Object.values(library)
    .filter((e) => e.review.trim())
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  const max = Math.max(1, ...stats.months.map((m) => m.count));
  return (
    <>
      <div className="profile-head">
        <Avatar profile={profile} name={name} size={92} />
        <div className="profile-identity">
          <h2>{name}</h2>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          <p className="muted">
            {email || "Votre collection est enregistrée sur cet appareil."}
          </p>
        </div>
      </div>
      <div className="profile-actions">
        <button className="button tonal" onClick={edit}>
          Modifier mon profil
        </button>
        <button
          className="button surface"
          onClick={() =>
            share(profileShare(profile, library, "Mon profil Vela"))
          }
        >
          <ShareIcon size={18} />
          Partager mon profil
        </button>
      </div>
      {pending && (
        <p className="muted fine">
          Les changements du profil sont enregistrés sur cet appareil et
          attendent leur synchronisation Supabase.
        </p>
      )}
      <div className="stats">
        {[
          [stats.watched, "Histoires vues"],
          [stats.watchlist, "Envies à venir"],
          [stats.favorites, "Coups de cœur"],
          [stats.average ?? "—", "Note moyenne / 5"],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section
        className="profile-section"
        aria-label="Les incontournables du profil"
      >
        <div className="section-heading">
          <div>
            <h2>Mes incontournables</h2>
          </div>
          <button className="text-button" onClick={edit}>
            Choisir <Plus size={16} />
          </button>
        </div>
        <div className="profile-featured">
          {Array.from({ length: 4 }, (_, i) => {
            const title = profile.featured[i];
            return title ? (
              <button
                className="featured-film"
                key={title.id}
                onClick={() => open(title)}
                aria-label={`Ouvrir ${title.name}`}
              >
                <span className="featured-poster">
                  {title.image ? (
                    <img src={title.image} alt="" loading="lazy" />
                  ) : (
                    <Film size={32} />
                  )}
                </span>
                <strong>{title.name}</strong>
                <small>
                  {title.year} · {title.kind === "movie" ? "Film" : "Série"}
                </small>
              </button>
            ) : (
              <button
                key={i}
                className="featured-empty"
                onClick={edit}
                aria-label={`Choisir le favori ${i + 1}`}
              >
                <Plus size={24} />
                <span>Votre choix</span>
              </button>
            );
          })}
        </div>
      </section>
      <section
        className="profile-section activity-panel surface"
        aria-label="Activité du profil"
      >
        <h2>Votre activité</h2>
        <p className="muted">
          {stats.movies} films et {stats.series} séries vus · {stats.reviews}{" "}
          avis rédigés
        </p>
        <div className="activity-summary">
          <div>
            <strong>{stats.thisMonth}</strong>
            <span>vus ce mois-ci</span>
          </div>
          <div>
            <strong>{stats.activeDays}</strong>
            <span>jours de visionnage</span>
          </div>
          <div>
            <strong>{stats.streak}</strong>
            <span>jours de suite</span>
          </div>
        </div>
        <div
          className="activity-chart"
          role="img"
          aria-label={stats.months
            .map((m) => `${m.label} : ${m.count} visionnages`)
            .join(", ")}
        >
          {stats.months.map((m) => (
            <div className="activity-column" key={m.key}>
              <span className="activity-count">{m.count}</span>
              <span className="activity-track">
                <span
                  style={{
                    height: `${m.count ? Math.max(6, (m.count / max) * 100) : 2}%`,
                  }}
                />
              </span>
              <small>{m.label}</small>
            </div>
          ))}
        </div>
        {stats.genres.length > 0 && (
          <div className="profile-genres">
            {stats.genres.map(([genre, count]) => (
              <span key={genre}>
                {genre}
                <small>{count}</small>
              </span>
            ))}
          </div>
        )}
        <p className="muted fine">
          D’après les titres marqués vus et leur date de visionnage. Les
          épisodes ne comptent pas comme des films.
        </p>
      </section>
      <section className="profile-section" aria-label="Mes avis">
        <div className="section-heading">
          <div>
            <h2>
              Mes avis <small>{reviews.length}</small>
            </h2>
          </div>
        </div>
        {!reviews.length ? (
          <p className="muted">
            Vos critiques apparaîtront ici. Écrivez votre premier avis depuis la
            fiche d’un film ou d’une série.
          </p>
        ) : (
          reviews.slice(0, reviewLimit).map((entry) => (
            <article key={entry.title.id} className="profile-review surface">
              <div className="review-heading">
                <button onClick={() => open(entry.title)}>
                  <strong>{entry.title.name}</strong>
                  <span>{entry.title.year}</span>
                </button>
                {entry.rating > 0 && (
                  <span className="review-rating">
                    <Star size={16} />
                    {entry.rating}/5
                  </span>
                )}
              </div>
              <p>{entry.review}</p>
              <button
                className="text-button"
                onClick={() =>
                  share(reviewShare(profile, entry, "Un regard sur Vela"))
                }
              >
                <ShareIcon size={17} />
                Partager cet avis
              </button>
            </article>
          ))
        )}
        {reviews.length > reviewLimit && (
          <button
            className="button tonal"
            onClick={() => setReviewLimit((n) => n + 6)}
          >
            Afficher plus d’avis
          </button>
        )}
      </section>
    </>
  );
}

import { t as tr, getLanguage } from "./i18n";
import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import SpoilerText from "./SpoilerText";
import type { Profile } from "./profile";
import { profileStats } from "./profile-stats";
import { profileShare, reviewShare, type ShareDraft } from "./sharing";
import type { StoryDraft } from "./story-image";
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
  story,
  monthly,
  protectSpoilers = true,
}: {
  monthly: () => void;
  protectSpoilers?: boolean;
  profile: Profile;
  library: Library;
  email?: string;
  edit: () => void;
  open: (t: Title) => void;
  toast: (s: string) => void;
  pending: boolean;
  share: (draft: ShareDraft) => void;
  story: (draft: StoryDraft) => void;
}) {
  const stats = useMemo(() => profileStats(library), [library, getLanguage()]),
    [reviewLimit, setReviewLimit] = useState(3);
  const name =
    profile.displayName ||
    email?.split("@")[0] ||
    tr("Le premier rôle, c’est vous.");
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
            {email || tr("Votre collection est enregistrée sur cet appareil.")}
          </p>
        </div>
      </div>
      <div className="profile-actions">
        <button className="button tonal" onClick={edit}>
          {tr("Modifier mon profil")}
        </button>
        <button className="button tonal" onClick={monthly}>
          {tr("Bilan mensuel")}
        </button>
        <button
          className="button surface"
          onClick={() =>
            share(profileShare(profile, library, tr("Mon profil Vela")))
          }
        >
          <ShareIcon size={18} />
          {tr("Partager mon profil")}
        </button>
      </div>
      {pending && (
        <p className="muted fine">
          {tr(
            "Les changements du profil sont enregistrés sur cet appareil et attendent leur synchronisation Supabase.",
          )}
        </p>
      )}
      <div className="stats">
        {[
          [stats.watched, tr("Histoires vues")],
          [stats.watchlist, tr("Envies à venir")],
          [stats.favorites, tr("Coups de cœur")],
          [stats.average ?? "—", tr("Note moyenne / 5")],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section
        className="profile-section"
        aria-label={tr("Les incontournables du profil")}
      >
        <div className="section-heading">
          <div>
            <h2>{tr("Mes incontournables")}</h2>
          </div>
          <button className="text-button" onClick={edit}>
            {tr("Choisir ")}
            <Plus size={16} />
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
                aria-label={tr("Ouvrir {0}", title.name)}
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
                  {title.year} ·{" "}
                  {title.kind === "movie" ? tr("Film") : tr("Série")}
                </small>
              </button>
            ) : (
              <button
                key={i}
                className="featured-empty"
                onClick={edit}
                aria-label={tr("Choisir le favori {0}", i + 1)}
              >
                <Plus size={24} />
                <span>{tr("Votre choix")}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section
        className="profile-section activity-panel surface"
        aria-label={tr("Activité du profil")}
      >
        <h2>{tr("Votre activité")}</h2>
        <p className="muted">
          {stats.movies} {tr(" films et ")}
          {stats.series} {tr(" séries vus · ")}
          {stats.reviews} {tr("avis rédigés")}
        </p>
        <div className="activity-summary">
          <div>
            <strong>{stats.thisMonth}</strong>
            <span>{tr("vus ce mois-ci")}</span>
          </div>
          <div>
            <strong>{stats.activeDays}</strong>
            <span>{tr("jours de visionnage")}</span>
          </div>
          <div>
            <strong>{stats.streak}</strong>
            <span>{tr("jours de suite")}</span>
          </div>
        </div>
        <div
          className="activity-chart"
          role="img"
          aria-label={stats.months
            .map((m) => tr("{0} : {1} visionnages", m.label, m.count))
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
              <span key={tr(genre)}>
                {tr(genre)}
                <small>{count}</small>
              </span>
            ))}
          </div>
        )}
        <p className="muted fine">
          {tr(
            "D’après les titres marqués vus et leur date de visionnage. Les épisodes ne comptent pas comme des films.",
          )}
        </p>
      </section>
      <section className="profile-section" aria-label={tr("Mes avis")}>
        <div className="section-heading">
          <div>
            <h2>
              {tr("Mes avis ")}
              <small>{reviews.length}</small>
            </h2>
          </div>
        </div>
        {!reviews.length ? (
          <p className="muted">
            {tr(
              "Vos critiques apparaîtront ici. Écrivez votre premier avis depuis la fiche d’un film ou d’une série.",
            )}
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
              <SpoilerText
                key={entry.title.id + entry.updated}
                text={entry.review}
                spoiler={entry.spoiler}
                protect={protectSpoilers}
              />
              <div className="review-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    share(reviewShare(profile, entry, tr("Un regard sur Vela")))
                  }
                >
                  <ShareIcon size={17} />
                  {tr("Partager cet avis")}
                </button>
                <button
                  className="text-button"
                  onClick={() => story({ entry, profile })}
                >
                  <ShareIcon size={17} /> {tr("Partager en story")}
                </button>
              </div>
            </article>
          ))
        )}
        {reviews.length > reviewLimit && (
          <button
            className="button tonal"
            onClick={() => setReviewLimit((n) => n + 6)}
          >
            {tr("Afficher plus d’avis")}
          </button>
        )}
      </section>
    </>
  );
}

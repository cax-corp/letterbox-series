import { t as tr, useLanguage, getLanguage } from "./i18n";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { readSharedPage, uuidPattern, type SharedPage } from "./public-sharing";
import { titleById, type Title } from "./catalog";
import { Film, Star } from "./icons";
export type PublicRoute = { kind: "title" | "share"; id: string };
export function parsePublicRoute(hash = location.hash): PublicRoute | null {
  const title = /^#\/title\/((?:tmdb-)?(?:movie|series)-\d+)$/.exec(hash);
  if (title) return { kind: "title", id: title[1] };
  const share = /^#\/s\/([^/]+)$/.exec(hash);
  if (share && uuidPattern.test(share[1]))
    return { kind: "share", id: share[1] };
  return null;
}
export default function PublicPage({
  route,
  renderTitle,
  open,
}: {
  route: PublicRoute;
  renderTitle: (title: Title) => React.ReactNode;
  open: (title: Title) => void;
}) {
  const language = useLanguage();
  const [page, setPage] = useState<SharedPage | null>(null),
    [title, setTitle] = useState<Title | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setPage(null);
    setTitle(null);
    setError("");
    (route.kind === "title"
      ? titleById(route.id, c.signal).then((t) => {
          if (!c.signal.aborted) setTitle(t);
        })
      : readSharedPage(route.id, c.signal).then((p) => {
          if (!c.signal.aborted) setPage(p);
        })
    ).catch((e) => {
      if (!c.signal.aborted) setError(e.message);
    });
    return () => c.abort();
  }, [route.kind, route.id, retry, language]);
  useEffect(() => {
    const previous = document.title;
    const name = title?.name || page?.payload.profile.displayName;
    if (name) document.title = `${name} — Vela`;
    return () => {
      document.title = previous;
    };
  }, [title?.name, page?.id]);
  if (error)
    return (
      <section className="page-section public-page">
        <h1>{tr("Lien public")}</h1>
        <p className="error" role="alert">
          {tr(error)}
        </p>
        <button className="button tonal" onClick={() => setRetry((n) => n + 1)}>
          {tr("Réessayer")}
        </button>
      </section>
    );
  if (title) return renderTitle(title);
  if (!page)
    return (
      <p className="page-section muted" role="status">
        {tr("Chargement de la page partagée…")}
      </p>
    );
  const p = page.payload.profile,
    r = page.payload.review,
    s = page.payload.stats;
  return (
    <section
      className="page-section public-page"
      aria-label={
        page.kind === "profile" ? tr("Profil public") : tr("Avis public")
      }
    >
      <div className="profile-head">
        <Avatar profile={p} name={p.displayName} size={92} />
        <div className="profile-identity">
          <h1>{p.displayName}</h1>
          {p.bio && <p className="profile-bio">{p.bio}</p>}
        </div>
      </div>
      {s && (
        <div className="stats">
          {[
            [s.watched, tr("Histoires vues")],
            [s.favorites, tr("Coups de cœur")],
            [s.reviews, tr("Avis")],
            [s.average ?? "—", tr("Note moyenne / 5")],
          ].map(([n, label]) => (
            <div key={label}>
              <strong>{n}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      {r ? (
        <article className="profile-review surface public-review">
          <button className="public-review-title" onClick={() => open(r.title)}>
            <h2>{r.title.name}</h2>
            <span>
              {r.title.year} {tr(" · Ouvrir la fiche ↗")}
            </span>
          </button>
          {r.rating > 0 && (
            <p className="review-rating">
              <Star size={18} />
              {r.rating}/5
            </p>
          )}
          <p>{r.text}</p>
        </article>
      ) : (
        p.featured.length > 0 && (
          <section className="profile-section">
            <h2>{tr("Les incontournables")}</h2>
            <div className="profile-featured">
              {p.featured.map((t) => (
                <button
                  className="featured-film"
                  key={t.id}
                  onClick={() => open(t)}
                >
                  <span className="featured-poster">
                    {t.image ? (
                      <img src={t.image} alt="" loading="lazy" />
                    ) : (
                      <Film size={30} />
                    )}
                  </span>
                  <strong>{t.name}</strong>
                  <small>{t.year}</small>
                </button>
              ))}
            </div>
          </section>
        )
      )}
      <p className="muted fine">
        {tr("Partagé le ")}
        {new Date(page.updated_at).toLocaleDateString(getLanguage())}
        {tr(
          ". Cette page présente le contenu publié par son auteur au moment du partage.",
        )}
      </p>
    </section>
  );
}

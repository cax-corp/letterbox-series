import { t as tr, getLanguage } from "./i18n";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Bookmark, ChevronRight, ShareIcon, Star } from "./icons";
import type { Entry } from "./store";
export default function TitleReview({
  entry,
  update,
  share,
  saved,
}: {
  entry: Entry;
  update: (patch: Partial<Entry>) => void;
  share: () => void;
  saved: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [review, setReview] = useState(entry.review);
  const reviewId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null),
    previous = useRef(entry.review);
  useEffect(() => {
    const old = previous.current;
    setReview((draft) => (draft === old ? entry.review : draft));
    previous.current = entry.review;
  }, [entry.review]);
  useEffect(() => {
    if (editing) textarea.current?.focus({ preventScroll: true });
  }, [editing]);
  return (
    <section className="review-panel" aria-label={tr("Votre avis")}>
      <div className="review-title">
        <h3>{tr("Votre avis")}</h3>
        <span className="review-own-score">
          {entry.rating > 0 ? `${entry.rating}/5` : tr("Non noté")}
        </span>
      </div>
      <div className="review-rating-row">
        <div
          className="stars editable"
          aria-label={tr("{0} sur 5", entry.rating)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={tr("Noter {0} sur 5", n)}
              aria-pressed={entry.rating === n}
              onClick={() =>
                update({
                  rating: entry.rating === n ? 0 : n,
                  watched: entry.rating !== n || entry.watched,
                  recommendationFeedback: undefined,
                })
              }
            >
              <Star
                size={24}
                className={n <= entry.rating ? "filled" : ""}
                fill={n <= entry.rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
      </div>
      {!editing ? (
        <>
          {entry.review.trim() && (
            <p className="review-excerpt">{entry.review}</p>
          )}
          <div className="review-actions">
            <button
              className="text-button review-edit"
              onClick={() => setEditing(true)}
            >
              {entry.review.trim()
                ? tr("Modifier mon avis")
                : tr("Écrire un avis")}{" "}
              <ArrowRight size={16} />
            </button>
            {entry.review.trim() && (
              <button className="text-button review-share" onClick={share}>
                <ShareIcon size={17} /> {tr(" Partager mon avis")}
              </button>
            )}
          </div>
        </>
      ) : (
        <form
          className="review-composer"
          onSubmit={(e) => {
            e.preventDefault();
            update({ review, watched: true });
            setEditing(false);
            saved();
          }}
        >
          <label className="sr-only" htmlFor={reviewId}>
            {tr("Votre critique")}
          </label>
          <textarea
            id={reviewId}
            ref={textarea}
            value={review}
            maxLength={5000}
            rows={4}
            placeholder={tr("Qu’en avez-vous pensé ?")}
            onChange={(e) => setReview(e.target.value)}
            onInput={(e) => {
              const field = e.currentTarget;
              field.style.height = "auto";
              field.style.height =
                Math.min(360, Math.max(120, field.scrollHeight)) + "px";
            }}
          />
          <div className="review-composer-footer">
            <span className="muted">
              {review.length.toLocaleString(getLanguage())} / 5 000
            </span>
            <div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setReview(entry.review);
                  setEditing(false);
                }}
              >
                {tr("Annuler")}
              </button>
              <button
                className="button primary"
                type="submit"
                aria-label={tr("Enregistrer mon avis")}
              >
                {tr("Enregistrer ")}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
export function PersonalTracking({
  entry,
  update,
}: {
  entry: Entry;
  update: (patch: Partial<Entry>) => void;
}) {
  return (
    <details className="detail-disclosure personal-tracking">
      <summary>
        <span>
          <Bookmark size={18} /> {tr(" Suivi personnel")}
        </span>
        <ChevronRight className="disclosure-chevron" size={18} />
      </summary>
      <div className="tracking-content">
        <label className="field">
          {tr("Date du visionnage")}
          <input
            type="date"
            value={entry.watchedAt}
            onChange={(e) => {
              if (e.target.value) update({ watchedAt: e.target.value });
            }}
          />
        </label>
        <label className="field">
          {tr("Vos listes personnelles")}
          <input
            defaultValue={(entry.lists || []).join(", ")}
            placeholder={tr("Soirée cinéma, À revoir…")}
            maxLength={500}
            onBlur={(e) =>
              update({
                lists: [
                  ...new Set(
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  ),
                ].slice(0, 20),
              })
            }
          />
          <span className="muted fine">
            {tr("Séparez les noms par une virgule.")}
          </span>
        </label>
      </div>
    </details>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { t as tr, getLanguage } from "./i18n";
import { ArrowRight, Star } from "./icons";
import type { Entry } from "./store";

/** Draft changes stay local to this form until the user saves. */
export default function ReviewEditor({
  entry,
  save,
  cancel,
}: {
  entry: Entry;
  save: (patch: Partial<Entry>) => void;
  cancel: () => void;
}) {
  const [rating, setRating] = useState(entry.rating),
    [text, setText] = useState(entry.review),
    [spoiler, setSpoiler] = useState(Boolean(entry.spoiler));
  const id = useId(),
    field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, []);
  return (
    <form
      className="review-composer profile-review-composer"
      aria-label={tr("Modifier l’avis sur {0}", entry.title.name)}
      onSubmit={(event) => {
        event.preventDefault();
        save({
          review: text,
          rating,
          spoiler: Boolean(text.trim()) && spoiler,
          watched: true,
          ...(rating !== entry.rating
            ? { recommendationFeedback: undefined }
            : {}),
        });
      }}
    >
      <div className="review-rating-row">
        <div className="stars editable" aria-label={tr("{0} sur 5", rating)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              aria-label={tr("Noter {0} sur 5", n)}
              aria-pressed={rating === n}
              onClick={() => setRating(rating === n ? 0 : n)}
            >
              <Star
                size={24}
                className={n <= rating ? "filled" : ""}
                fill={n <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
        <span className="muted fine">
          {rating > 0 ? `${rating}/5` : tr("Non noté")}
        </span>
      </div>
      <label className="sr-only" htmlFor={id}>
        {tr("Votre critique")}
      </label>
      <textarea
        id={id}
        ref={field}
        value={text}
        rows={4}
        maxLength={5000}
        placeholder={tr("Qu’en avez-vous pensé ?")}
        onChange={(event) => setText(event.target.value)}
      />
      <label className="preference-toggle">
        <input
          type="checkbox"
          checked={spoiler}
          onChange={(event) => setSpoiler(event.target.checked)}
        />
        {tr("Cet avis contient des spoilers")}
      </label>
      <div className="review-composer-footer">
        <span className="muted">
          {text.length.toLocaleString(getLanguage())} / 5 000
        </span>
        <div>
          <button type="button" className="text-button" onClick={cancel}>
            {tr("Annuler")}
          </button>
          <button
            type="submit"
            className="button primary"
            aria-label={tr("Enregistrer mon avis")}
          >
            {tr("Enregistrer ")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}

import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import {
  avatarBackgrounds,
  avatarOptions,
  featuredTitle,
  type Profile,
} from "./profile";
import type { Library } from "./store";
import { ArrowLeft, ArrowRight, Check, Film, X } from "./icons";
export default function ProfileEditor({
  initial,
  library,
  defaultName,
  connected,
  busy,
  save,
  close,
  toast,
}: {
  initial: Profile;
  library: Library;
  defaultName: string;
  connected: boolean;
  busy: boolean;
  save: (p: Omit<Profile, "version" | "updated">) => Promise<"local" | "cloud">;
  close: () => void;
  toast: (s: string) => void;
}) {
  const [draft, setDraft] = useState({
      ...initial,
      displayName: initial.displayName || defaultName,
    }),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
    };
  }, []);
  const choices = Object.values(library)
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.title.name.localeCompare(b.title.name),
    )
    .filter((e) =>
      e.title.name
        .toLocaleLowerCase("fr-FR")
        .includes(query.toLocaleLowerCase("fr-FR")),
    );
  function toggle(title: Profile["featured"][number]) {
    setError("");
    setDraft((d) => {
      const exists = d.featured.some((t) => t.id === title.id);
      if (!exists && d.featured.length >= 4) {
        setError(
          "Vous pouvez mettre quatre titres à l’honneur. Retirez-en un pour le remplacer.",
        );
        return d;
      }
      return {
        ...d,
        featured: exists
          ? d.featured.filter((t) => t.id !== title.id)
          : [...d.featured, featuredTitle(title)],
      };
    });
  }
  function move(index: number, delta: number) {
    setDraft((d) => {
      const featured = [...d.featured],
        target = index + delta;
      [featured[index], featured[target]] = [featured[target], featured[index]];
      return { ...d, featured };
    });
  }
  return (
    <section
      className="profile-editor page-section"
      aria-label="Modifier mon profil"
    >
      <button className="text-button settings-back" onClick={close}>
        <ArrowLeft size={20} />
        Retour au profil
      </button>
      <h1 ref={heading} tabIndex={-1}>
        À votre image.
      </h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving || busy) return;
          setSaving(true);
          setError("");
          try {
            const outcome = await save(draft);
            if (mounted.current) {
              toast(
                outcome === "cloud"
                  ? "Profil enregistré et synchronisé avec Supabase."
                  : connected
                    ? "Profil enregistré sur cet appareil. Il sera synchronisé avec la prochaine sauvegarde."
                    : "Profil enregistré sur cet appareil.",
              );
              close();
            }
          } catch (e) {
            if (mounted.current)
              setError(
                e instanceof Error
                  ? e.message
                  : "Le profil ne peut pas être enregistré.",
              );
          } finally {
            if (mounted.current) setSaving(false);
          }
        }}
      >
        <div className="profile-edit-preview">
          <Avatar profile={draft} name={draft.displayName} size={128} />
          <p>Votre place au premier rang.</p>
        </div>
        <label className="field">
          Nom affiché
          <input
            required
            maxLength={40}
            value={draft.displayName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, displayName: e.target.value }))
            }
            autoComplete="nickname"
          />
        </label>
        <label className="field">
          Quelques mots sur vous
          <textarea
            maxLength={160}
            rows={3}
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            placeholder="Vos genres préférés, votre rituel cinéma…"
          />
          <small className="muted">{draft.bio.length}/160</small>
        </label>
        <fieldset>
          <legend>Choisissez votre avatar</legend>
          <p className="muted fine">
            Des avatars inclus dans Vela. Aucune photo personnelle à importer.
          </p>
          <div className="avatar-choices">
            {avatarOptions.map((a) => (
              <button
                key={a.id}
                type="button"
                className={draft.avatar === a.id ? "selected" : ""}
                aria-pressed={draft.avatar === a.id}
                aria-label={a.label}
                onClick={() => setDraft((d) => ({ ...d, avatar: a.id }))}
              >
                <Avatar
                  profile={{ ...draft, avatar: a.id }}
                  name={draft.displayName}
                  size={64}
                />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Couleur du fond</legend>
          <div className="avatar-colors">
            {avatarBackgrounds.map((b) => (
              <button
                type="button"
                key={b.id}
                aria-label={b.label}
                aria-pressed={draft.background === b.id}
                style={{ background: b.color, color: b.ink }}
                onClick={() => setDraft((d) => ({ ...d, background: b.id }))}
              >
                {draft.background === b.id && <Check size={20} />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Vos quatre incontournables</legend>
          <p className="muted fine">
            Mettez à l’honneur jusqu’à quatre films ou séries de votre
            collection. Cette sélection ne change pas vos likes.
          </p>
          {draft.featured.length > 0 && (
            <ol className="featured-order">
              {draft.featured.map((t, i) => (
                <li key={t.id}>
                  <span>
                    {i + 1}. {t.name}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={i === 0}
                      aria-label={`Déplacer ${t.name} vers la gauche`}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={i === draft.featured.length - 1}
                      aria-label={`Déplacer ${t.name} vers la droite`}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowRight size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Retirer ${t.name} des incontournables`}
                      onClick={() => toggle(t)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {choices.length > 0 || query ? (
            <>
              <label className="field">
                Rechercher dans ma collection
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="featured-choices">
                {choices.slice(0, 60).map((e) => (
                  <button
                    type="button"
                    key={e.title.id}
                    aria-pressed={draft.featured.some(
                      (t) => t.id === e.title.id,
                    )}
                    onClick={() => toggle(e.title)}
                  >
                    <span className="featured-choice-poster">
                      {e.title.image ? (
                        <img src={e.title.image} alt="" loading="lazy" />
                      ) : (
                        <Film size={20} />
                      )}
                    </span>
                    <span>
                      {e.title.name}
                      <small>{e.title.year}</small>
                    </span>
                    {draft.featured.some((t) => t.id === e.title.id) && (
                      <Check size={18} />
                    )}
                  </button>
                ))}
              </div>
              {choices.length > 60 && (
                <p className="muted fine">
                  Affinez la recherche pour trouver d’autres titres de votre
                  collection.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              Ajoutez des titres à votre collection depuis Explorer pour pouvoir
              les choisir ici.
            </p>
          )}
        </fieldset>
        <p className="muted fine">
          {connected
            ? "Votre nom, votre avatar et vos incontournables sont synchronisés avec votre compte Supabase. Les avatars sont inclus dans Vela. Hors connexion, vos choix attendent la prochaine sauvegarde."
            : "Votre profil reste sur cet appareil. Connectez-vous pour personnaliser et sauvegarder le profil de votre compte."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-editor-actions">
          <button className="button primary" disabled={saving || busy}>
            {saving || busy ? "Enregistrement…" : "Enregistrer mon profil"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={saving || busy}
            onClick={close}
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}

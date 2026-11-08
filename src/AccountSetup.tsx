import { useEffect, useRef, useState } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { t as tr, useLanguage, type AppLanguage } from "./i18n";
import { Brand } from "./Brand";
import Avatar from "./Avatar";
import {
  avatarOptions,
  avatarBackgrounds,
  makeProfile,
  type Profile,
} from "./profile";
import ColourThemePicker from "./ColourThemePicker";
import LanguageSelect from "./LanguageSelect";
import ViewingSettings from "./ViewingSettings";
import type { ViewingPreferences } from "./viewing-preferences";
import { setupMovies } from "./catalog";
import type { Library } from "./store";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Like,
  Dislike,
  LoaderCircle,
} from "./icons";
import {
  cacheSetup,
  chooseSetupTitles,
  readSetupDraft,
  saveSetupProgress,
  type SetupDraft,
  type SetupAnswer,
} from "./account-setup";

const steps = ["Profil", "Apparence", "Pays et services", "Vos goûts"];
export default function AccountSetup({
  user,
  profile,
  viewing,
  library,
  palette,
  theme,
  setPalette,
  setTheme,
  setLanguage,
  commitTastes,
  finish,
  postpone,
  backHandler,
}: {
  user: AuthUser;
  profile: Profile;
  viewing: ViewingPreferences;
  library: Library;
  palette: string;
  theme: "dark" | "light" | "system";
  setPalette: (v: string) => void;
  setTheme: (v: "dark" | "light" | "system") => void;
  setLanguage: (v: AppLanguage) => void;
  commitTastes: (draft: SetupDraft) => Promise<void>;
  finish: () => void;
  postpone: () => void;
  backHandler: { current: () => boolean };
}) {
  const language = useLanguage();
  const [draft, setDraft] = useState<SetupDraft>(() =>
    readSetupDraft(user, {
      version: 1,
      status: "pending",
      updated: new Date().toISOString(),
      step: 0,
      firstName: user.user_metadata?.first_name || "",
      lastName: user.user_metadata?.last_name || "",
      profile: {
        ...profile,
        displayName:
          profile.displayName ||
          user.email?.split("@")[0].slice(0, 40) ||
          "Vela",
      },
      palette,
      theme,
      country: viewing.country,
      providers: viewing.providers,
      titles: [],
      answers: {},
    }),
  );
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const live = useRef(true),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    backHandler.current = () => {
      if (!busy) {
        if (draft.step > 0) change({ step: draft.step - 1 });
        else {
          cacheSetup(user.id, draft);
          postpone();
        }
      }
      return true;
    };
    return () => {
      backHandler.current = () => false;
    };
  }, [draft, busy]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [draft.step]);
  function change(patch: Partial<SetupDraft>) {
    setDraft((old) => {
      const next = { ...old, ...patch, updated: new Date().toISOString() };
      cacheSetup(user.id, next);
      return next;
    });
  }
  useEffect(() => {
    if (draft.step !== 3 || draft.titles.length >= 5) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setupMovies(controller.signal)
      .then((pool) => {
        if (controller.signal.aborted) return;
        const titles = chooseSetupTitles(pool, new Set(Object.keys(library)));
        if (titles.length < 5) throw new Error("not enough titles");
        change({ titles, answers: {} });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            tr(
              "Les films ne sont pas disponibles pour le moment. Réessayez, ou terminez sans cette étape.",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [draft.step, retry, language]);
  const cursor = draft.titles.findIndex((t) => !draft.answers[t.id]);
  const title = cursor >= 0 ? draft.titles[cursor] : null;
  const answered = draft.titles.filter((t) => draft.answers[t.id]).length;
  async function persist(step: number, complete = false) {
    if (busy || (draft.step === 2 && !draft.country)) return;
    setBusy(true);
    setError("");
    try {
      const updated = new Date(
        Math.max(Date.now(), Date.parse(draft.updated) + 1),
      ).toISOString();
      const next: SetupDraft = {
        ...draft,
        palette,
        theme,
        updated,
        step,
        profile: makeProfile(draft.profile, profile),
        status: "pending",
      };
      await saveSetupProgress(user.id, next, language);
      if (!live.current) return;
      if (complete) {
        await commitTastes(next);
        if (!live.current) return;
        const done: SetupDraft = {
          ...next,
          status: "complete",
          updated: new Date(
            Math.max(Date.now(), Date.parse(updated) + 1),
          ).toISOString(),
        };
        await saveSetupProgress(user.id, done, language);
        if (live.current) finish();
      } else {
        setDraft(next);
      }
    } catch {
      cacheSetup(user.id, {
        ...draft,
        updated: new Date(Date.now() + 1).toISOString(),
      });
      if (live.current)
        setError(
          tr(
            "Vos choix sont conservés sur cet appareil. La sauvegarde du compte n’a pas abouti ; réessayez.",
          ),
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  function answer(value: SetupAnswer) {
    if (title) change({ answers: { ...draft.answers, [title.id]: value } });
  }
  return (
    <main
      className="account-screen setup-page"
      aria-label={tr("Configuration du profil")}
    >
      <header>
        <span className="welcome-brand" aria-label="Vela">
          <Brand />
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            cacheSetup(user.id, draft);
            postpone();
          }}
        >
          {tr("Reprendre plus tard")}
        </button>
      </header>
      <div className="setup-layout">
        <aside className="setup-intro">
          <span className="setup-count">
            {tr("Étape {0} sur 4", draft.step + 1)}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {tr("Configurons votre profil.")}
          </h1>
          <p>
            {tr(
              "Choisissez votre style et donnez un premier aperçu de vos goûts.",
            )}
          </p>
          <ol className="setup-stepper">
            {steps.map((label, i) => (
              <li
                key={label}
                aria-current={draft.step === i ? "step" : undefined}
                className={i < draft.step ? "done" : ""}
              >
                <span>{i < draft.step ? <Check size={15} /> : i + 1}</span>
                {tr(label)}
              </li>
            ))}
          </ol>
          <Avatar
            profile={draft.profile}
            name={draft.profile.displayName}
            size={100}
          />
        </aside>
        <section className="setup-content" aria-label={tr(steps[draft.step])}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void persist(Math.min(3, draft.step + 1), draft.step === 3);
            }}
          >
            {draft.step === 0 && (
              <>
                <h2>{tr("Faisons connaissance.")}</h2>
                <div className="setup-name-row">
                  <label className="field">
                    {tr("Prénom")}
                    <input
                      required
                      maxLength={60}
                      autoComplete="given-name"
                      value={draft.firstName}
                      onChange={(e) => change({ firstName: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    {tr("Nom (facultatif)")}
                    <input
                      maxLength={60}
                      autoComplete="family-name"
                      value={draft.lastName}
                      onChange={(e) => change({ lastName: e.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  {tr("Nom affiché")}
                  <input
                    required
                    maxLength={40}
                    autoComplete="nickname"
                    value={draft.profile.displayName}
                    onChange={(e) =>
                      change({
                        profile: {
                          ...draft.profile,
                          displayName: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <fieldset>
                  <legend>{tr("Choisissez votre avatar")}</legend>
                  <div className="avatar-choices">
                    {avatarOptions.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        aria-label={tr(a.label)}
                        aria-pressed={draft.profile.avatar === a.id}
                        className={
                          draft.profile.avatar === a.id ? "selected" : ""
                        }
                        onClick={() =>
                          change({
                            profile: { ...draft.profile, avatar: a.id },
                          })
                        }
                      >
                        <Avatar
                          profile={{ ...draft.profile, avatar: a.id }}
                          name={draft.profile.displayName}
                          size={55}
                        />
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{tr("Fond de l’avatar")}</legend>
                  <div className="setup-backgrounds">
                    {avatarBackgrounds.map((bg) => (
                      <button
                        type="button"
                        key={bg.id}
                        aria-label={tr(bg.label)}
                        aria-pressed={draft.profile.background === bg.id}
                        onClick={() =>
                          change({
                            profile: { ...draft.profile, background: bg.id },
                          })
                        }
                        style={{ background: bg.color, color: bg.ink }}
                      >
                        {draft.profile.background === bg.id && (
                          <Check size={18} />
                        )}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            {draft.step === 1 && (
              <>
                <h2>{tr("Votre Vela, vos couleurs.")}</h2>
                <ColourThemePicker value={palette} onChange={setPalette} />
                <label className="field">
                  {tr("Mode d’affichage")}
                  <select
                    aria-label={tr("Mode d’affichage")}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as typeof theme)}
                  >
                    <option value="dark">{tr("Mode sombre")}</option>
                    <option value="light">{tr("Mode clair")}</option>
                    <option value="system">{tr("Suivre le système")}</option>
                  </select>
                </label>
              </>
            )}
            {draft.step === 2 && (
              <>
                <h2>{tr("Votre langue et vos services.")}</h2>
                <LanguageSelect value={language} onChange={setLanguage} />
                <ViewingSettings
                  value={{
                    version: 1,
                    country: draft.country,
                    providers: draft.providers,
                    updated: draft.updated,
                  }}
                  save={(country, providers) => change({ country, providers })}
                  message=""
                />
              </>
            )}
            {draft.step === 3 && (
              <>
                <h2>{tr("Cinq films pour commencer.")}</h2>
                <p className="muted">
                  {tr(
                    "Dites ce que vous avez aimé. Ces réponses n’ajoutent ni notes, ni films vus, ni coups de cœur à votre collection.",
                  )}
                </p>
                {loading ? (
                  <div className="setup-movie-loading" role="status">
                    <LoaderCircle className="spin" />
                    {tr("Préparation de vos cinq films…")}
                  </div>
                ) : title ? (
                  <article className="setup-movie" key={title.id}>
                    <div className="setup-movie-art">
                      {title.image ? (
                        <img src={title.image} alt="" />
                      ) : (
                        <span>vela.</span>
                      )}
                      <span className="setup-movie-count">
                        {cursor + 1} / 5
                      </span>
                    </div>
                    <div>
                      <p className="muted">
                        {title.year} · {title.genres.join(" / ")}
                      </p>
                      <h3>{title.name}</h3>
                      <p className="setup-movie-summary">{title.summary}</p>
                    </div>
                    <div className="setup-votes">
                      <button
                        type="button"
                        className="button tonal"
                        onClick={() => answer("dislike")}
                      >
                        <Dislike size={20} />
                        {tr("Je n’aime pas")}
                      </button>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => answer("like")}
                      >
                        <Like size={20} />
                        {tr("J’aime")}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => answer("skip")}
                      >
                        {tr("Je ne connais pas")}
                      </button>
                    </div>
                  </article>
                ) : draft.titles.length === 5 ? (
                  <div className="setup-votes-complete">
                    <Check size={34} />
                    <h3>{tr("Vos premières préférences sont prêtes.")}</h3>
                    <p>
                      {tr(
                        "Vous pourrez les affiner au fil de vos découvertes.",
                      )}
                    </p>
                  </div>
                ) : null}
                {answered > 0 && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const previous =
                        draft.titles[Math.max(0, cursor < 0 ? 4 : cursor - 1)];
                      const answers = { ...draft.answers };
                      delete answers[previous.id];
                      change({ answers });
                    }}
                  >
                    {tr("Revenir au film précédent")}
                  </button>
                )}
                {!loading && draft.titles.length < 5 && (
                  <div className="setup-retry">
                    <button
                      type="button"
                      className="button tonal"
                      onClick={() => setRetry((v) => v + 1)}
                    >
                      {tr("Réessayer")}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void persist(3, true)}
                    >
                      {tr("Terminer sans ces titres")}
                    </button>
                  </div>
                )}
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <footer className="setup-actions">
              {draft.step > 0 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => change({ step: draft.step - 1 })}
                >
                  <ArrowLeft size={18} />
                  {tr("Retour")}
                </button>
              )}
              <button
                className="button primary"
                disabled={
                  busy ||
                  (draft.step === 2 && !draft.country) ||
                  (draft.step === 3 && answered < 5)
                }
                aria-busy={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    {tr(draft.step === 3 ? "Commencer avec Vela" : "Continuer")}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}

import LanguageSelect from "./LanguageSelect";
import { saveGuestLanguage } from "./language-preferences";
import { t as tr, useLanguage } from "./i18n";
import { useId, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, LoaderCircle } from "./icons";
import { CountrySelect } from "./ViewingSettings";
import { emptyViewing } from "./viewing-preferences";
import { cloud } from "./store";

export type AuthResult = { email: string; needsConfirmation: boolean };
export default function AuthForm({
  initialMode = "signin",
  initialEmail = "",
  success,
}: {
  initialMode?: "signin" | "signup";
  initialEmail?: string;
  success: (result: AuthResult) => void;
}) {
  const language = useLanguage();
  const passwordHint = useId();
  const [signup, setSignup] = useState(initialMode === "signup"),
    [country, setCountry] = useState(""),
    [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="form-content">
      <h2>{signup ? tr("Créer un compte") : tr("Connexion")}</h2>
      <LanguageSelect value={language} onChange={saveGuestLanguage} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          if (!cloud) {
            setError(
              tr("Le service de connexion est indisponible pour le moment."),
            );
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = signup
              ? await cloud.auth.signUp({
                  email: email.trim(),
                  password,
                  options: {
                    data: {
                      vela_language: {
                        version: 1,
                        code: language,
                        updated: new Date().toISOString(),
                      },
                      vela_viewing: {
                        ...emptyViewing,
                        country,
                        updated: new Date().toISOString(),
                      },
                    },
                    ...(!Capacitor.isNativePlatform()
                      ? { emailRedirectTo: location.origin + location.pathname }
                      : {}),
                  },
                })
              : await cloud.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
            if (result.error) throw result.error;
            success({
              email: email.trim(),
              needsConfirmation: signup && !result.data.session,
            });
          } catch (issue) {
            setError(
              issue instanceof Error
                ? issue.message
                : tr("Connexion indisponible. Réessayez."),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          {tr("E-mail")}
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          {tr("Mot de passe")}
          <input
            type="password"
            aria-label={tr("Mot de passe")}
            aria-describedby={signup ? passwordHint : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {signup && (
            <small id={passwordHint} className="muted">
              {tr("8 caractères minimum.")}
            </small>
          )}
        </label>
        {signup && (
          <CountrySelect required value={country} onChange={setCountry} />
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy} aria-busy={busy}>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={18} /> {tr(" Patientez…")}
            </>
          ) : signup ? (
            tr("Créer mon compte")
          ) : (
            tr("Se connecter")
          )}
        </button>
      </form>
      <button
        className="text-button auth-toggle"
        disabled={busy}
        onClick={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup ? tr("J’ai déjà un compte") : tr("Créer un compte gratuit")}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

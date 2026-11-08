import { useEffect, useState } from "react";
import { t as tr } from "./i18n";
import { cloud } from "./store";
import { authReturn } from "./auth-return";
import { confirmationUrl } from "./auth-urls";
import { Brand } from "./Brand";
import { ArrowRight, Check, LoaderCircle, Mail } from "./icons";

export default function AuthConfirmation({
  ready,
  continueToApp,
  signIn,
}: {
  ready: boolean;
  continueToApp: () => void;
  signIn: () => void;
}) {
  const [state, setState] = useState<"checking" | "valid" | "invalid">(
    "checking",
  );
  const [email, setEmail] = useState(""),
    [sending, setSending] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!ready) return;
    let live = true;
    if (authReturn?.error || !cloud) {
      setState("invalid");
      return;
    }
    void (async () => {
      try {
        const session = await cloud.auth.getSession();
        if (
          session.error ||
          !session.data.session ||
          (authReturn?.accessToken &&
            authReturn.accessToken !== session.data.session.access_token)
        )
          throw new Error("invalid");
        // A URL flag or a cached user is not proof of a confirmed address.
        const result = await cloud.auth.getUser();
        if (
          result.error ||
          !result.data.user?.email_confirmed_at ||
          result.data.user.id !== session.data.session.user.id
        )
          throw new Error("invalid");
        if (live) {
          setEmail(result.data.user.email || "");
          setState("valid");
        }
      } catch {
        if (live) setState("invalid");
      }
    })();
    return () => {
      live = false;
    };
  }, [ready]);
  return (
    <main
      className="account-screen confirmation-page"
      aria-label={tr("Confirmation de l’adresse e-mail")}
    >
      <header>
        <span className="welcome-brand" aria-label="Vela">
          <Brand />
        </span>
      </header>
      <section className="confirmation-card" aria-live="polite">
        <span className={`confirmation-symbol ${state}`} aria-hidden="true">
          {state === "checking" ? (
            <LoaderCircle size={36} className="spin" />
          ) : state === "valid" ? (
            <Check size={36} />
          ) : (
            <Mail size={36} />
          )}
        </span>
        <h1>
          {tr(
            state === "checking"
              ? "Vérification de votre adresse…"
              : state === "valid"
                ? "Votre adresse e-mail est validée."
                : "Ce lien ne peut pas être validé.",
          )}
        </h1>
        {state === "checking" ? (
          <p>{tr("Nous vérifions la confirmation auprès de Supabase.")}</p>
        ) : state === "valid" ? (
          <>
            <p>
              <strong>{email}</strong>
            </p>
            <p>
              {tr("Votre compte est prêt. Vous pouvez continuer dans Vela.")}
            </p>
            <button className="button primary" onClick={continueToApp}>
              {tr("Continuer dans Vela")} <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <p>
              {tr(
                "Il a peut-être expiré ou déjà été utilisé. Connectez-vous si votre adresse est déjà confirmée, ou demandez un nouveau lien.",
              )}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!cloud || sending) return;
                setSending(true);
                setMessage("");
                try {
                  const result = await cloud.auth.resend({
                    type: "signup",
                    email: email.trim(),
                    options: { emailRedirectTo: confirmationUrl() },
                  });
                  if (result.error) throw result.error;
                  setMessage(
                    tr(
                      "Un nouveau lien a été demandé. Vérifiez votre boîte mail et les indésirables.",
                    ),
                  );
                } catch {
                  setMessage(
                    tr(
                      "Le lien n’a pas pu être envoyé. Réessayez dans un instant.",
                    ),
                  );
                } finally {
                  setSending(false);
                }
              }}
            >
              <label className="field">
                {tr("E-mail")}
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="button primary" disabled={sending || !cloud}>
                {sending ? tr("Patientez…") : tr("Renvoyer un lien")}
              </button>
            </form>
            {message && <p role="status">{message}</p>}
            <button className="text-button" onClick={signIn}>
              {tr("Se connecter")}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

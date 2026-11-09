import { defaultServices } from "./service-config";
import { t as tr } from "./i18n";
import { useEffect, useState } from "react";
import { cloud } from "./store";
import { shareError } from "./public-sharing";
import { sharedPageUrl } from "./sharing";
import { Clipboard } from "@capacitor/clipboard";
import sql from "../supabase/public-sharing.sql?raw";
export default function PublicSharingSettings({
  account,
  signIn,
}: {
  account: string;
  signIn: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<
      { id: string; kind: string; payload: any; updated_at: string }[]
    >([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setRows([]);
    setError("");
    if (!cloud || account === "local" || !expanded) return;
    setLoading(true);
    cloud
      .from("vela_shares")
      .select("id,kind,payload,updated_at")
      .eq("owner_id", account)
      .order("updated_at", { ascending: false })
      .limit(100)
      .abortSignal(c.signal)
      .then(({ data, error }) => {
        if (c.signal.aborted) return;
        setLoading(false);
        if (error) setError(shareError(error));
        else setRows(data || []);
      });
    return () => c.abort();
  }, [account, retry, expanded]);
  async function remove(id: string) {
    if (!cloud || busy) return;
    setBusy(id);
    setError("");
    const { error } = await cloud
      .from("vela_shares")
      .delete()
      .eq("id", id)
      .eq("owner_id", account);
    setBusy("");
    if (error) setError(shareError(error));
    else {
      setRows((previous) => previous.filter((r) => r.id !== id));
      setMessage(tr("Lien retiré. Il ne donne plus accès à cette page."));
    }
  }
  return (
    <section
      aria-label={tr("Liens publics")}
      className="public-sharing-settings"
    >
      <h2>{tr("Liens publics")}</h2>
      <p className="muted">
        {tr(
          "Seuls les profils et avis que vous partagez sont publiés. Votre e-mail, votre pays, vos services et votre collection restent privés. Partagez à nouveau pour actualiser une page existante.",
        )}
      </p>
      {account === "local" ? (
        <button className="button tonal" onClick={signIn}>
          {tr("Se connecter pour publier un profil ou un avis")}
        </button>
      ) : !expanded ? (
        <button className="button tonal" onClick={() => setExpanded(true)}>
          {tr("Gérer mes liens publics")}
        </button>
      ) : (
        <>
          {loading && (
            <p role="status" className="muted">
              {tr("Chargement des liens…")}
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              {tr(error)}
              <button onClick={() => setRetry((n) => n + 1)}>
                {tr("Réessayer les liens")}
              </button>
            </div>
          )}
          {!loading && !error && !rows.length && (
            <p className="muted">
              {tr("Vous n’avez pas encore publié de lien.")}
            </p>
          )}
          <div className="published-share-list">
            {rows.map((row) => (
              <div key={row.id} className="published-share surface">
                <a
                  href={sharedPageUrl(row.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.kind === "profile"
                    ? tr("Mon profil")
                    : tr(
                        "Mon avis · {0}",
                        row.payload?.review?.title?.name || "Titre",
                      )}{" "}
                  ↗
                </a>
                <button
                  className="text-button"
                  disabled={Boolean(busy)}
                  onClick={() => remove(row.id)}
                >
                  {tr("Retirer ce lien")}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {message && (
        <p className="muted fine" role="status">
          {tr(message)}
        </p>
      )}
      {!defaultServices.supabaseUrl && import.meta.env.DEV && (
        <details className="advanced-services">
          <summary>
            {tr("Activer le partage sur votre projet Supabase")}
          </summary>
          <p className="muted">
            {tr(
              "Dans le SQL Editor de votre projet, exécutez ce script une fois. Il ajoute les pages partagées sans rendre la bibliothèque privée accessible.",
            )}
          </p>
          <button
            className="button tonal"
            onClick={async () => {
              try {
                await Clipboard.write({ string: sql });
                setMessage(tr("Script SQL copié."));
              } catch {
                setMessage(
                  tr("La copie a échoué. Sélectionnez le script ci-dessous."),
                );
              }
            }}
          >
            {tr("Copier le SQL du partage public")}
          </button>
          <textarea
            aria-label={tr("Script SQL du partage public")}
            readOnly
            value={sql}
            rows={8}
          />
        </details>
      )}
    </section>
  );
}

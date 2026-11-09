import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";
import { t as tr, getLanguage } from "./i18n";
import { Download } from "./icons";
export const appVersion = "2.10.1";
type UpdateState = {
  available: boolean;
  version: string;
  url: string;
  enabled: boolean;
  granted: boolean;
  lastCheck: number;
};
interface UpdatePlugin {
  getState(): Promise<UpdateState>;
  check(options: { force: boolean }): Promise<UpdateState>;
  configure(options: {
    enabled: boolean;
    language: string;
  }): Promise<UpdateState>;
  requestPermission(): Promise<UpdateState>;
  openDownload(): Promise<void>;
}
const native = registerPlugin<UpdatePlugin>("AppUpdates");
const supported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export function useAppUpdates() {
  const [state, setState] = useState<UpdateState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supported()) return;
    let live = true;
    const refresh = () => {
      if (document.hidden) return;
      void native
        .getState()
        .then((s) => {
          if (live) setState(s);
          return native.check({ force: false });
        })
        .then((s) => {
          if (live) setState(s);
        })
        .catch(() => {});
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    if (supported() && state)
      void native
        .configure({ enabled: state.enabled, language: getLanguage() })
        .catch(() => {});
  }, [getLanguage(), state?.enabled]);
  async function check() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setState(await native.check({ force: true }));
    } catch {
      setError(tr("La vérification des mises à jour n’a pas abouti."));
    } finally {
      setBusy(false);
    }
  }
  async function enabled(value: boolean) {
    try {
      setState(
        await native.configure({ enabled: value, language: getLanguage() }),
      );
      if (value) setState(await native.requestPermission());
      setError("");
    } catch {
      setError(
        tr("Les notifications de mise à jour n’ont pas pu être activées."),
      );
    }
  }
  async function download() {
    try {
      await native.openDownload();
    } catch {
      setError(tr("Le téléchargement ne peut pas être ouvert."));
    }
  }
  return {
    state,
    busy,
    error,
    check,
    enabled,
    download,
    supported: supported(),
  };
}
export function UpdateBanner({
  updates,
}: {
  updates: ReturnType<typeof useAppUpdates>;
}) {
  return updates.state?.available ? (
    <aside className="update-banner surface" role="status">
      <div>
        <strong>{tr("Une mise à jour de Vela est disponible")}</strong>
        <p>{tr("Version {0}", updates.state.version)}</p>
      </div>
      <button className="button primary" onClick={updates.download}>
        <Download size={18} />
        {tr("Télécharger")}
      </button>
    </aside>
  ) : null;
}
export function UpdateSettings({
  updates,
}: {
  updates: ReturnType<typeof useAppUpdates>;
}) {
  return (
    <section className="update-settings" aria-label={tr("Mises à jour")}>
      <h2>{tr("Mises à jour")}</h2>
      <p>{tr("Vela · Version {0}", appVersion)}</p>
      {updates.supported ? (
        <>
          <label className="preference-toggle">
            <input
              type="checkbox"
              checked={updates.state?.enabled ?? true}
              onChange={(e) => updates.enabled(e.target.checked)}
            />
            {tr("M’avertir des nouvelles versions")}
          </label>
          <p className="fine muted">
            {tr(
              "Vérification quotidienne légère en arrière-plan. Le téléchargement commence uniquement à votre demande.",
            )}
          </p>
          {updates.state && !updates.state.granted && (
            <button
              className="text-button"
              onClick={() => updates.enabled(true)}
            >
              {tr("Autoriser les notifications")}
            </button>
          )}
          <button
            className="button tonal"
            disabled={updates.busy}
            onClick={updates.check}
          >
            {updates.busy
              ? tr("Vérification…")
              : tr("Vérifier les mises à jour")}
          </button>
          {updates.state?.available ? (
            <button className="button primary" onClick={updates.download}>
              {tr("Télécharger la version {0}", updates.state.version)}
            </button>
          ) : updates.state?.lastCheck ? (
            <p className="fine muted">{tr("Votre application est à jour.")}</p>
          ) : null}
          {updates.error && (
            <p className="error" role="status">
              {updates.error}
            </p>
          )}
        </>
      ) : (
        <p className="muted fine">
          {tr(
            "La version web se met à jour automatiquement. Les alertes concernent l’application Android.",
          )}
        </p>
      )}
    </section>
  );
}

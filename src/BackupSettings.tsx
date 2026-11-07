import { t as tr, getLanguage } from "./i18n";
import type { BackupFrequency } from "./backup";
import type { BackupController } from "./useCloudBackup";
export default function BackupSettings({
  backup,
  connected,
  configured,
  signIn,
  setFrequency,
}: {
  backup: BackupController;
  connected: boolean;
  configured: boolean;
  signIn?: () => void;
  setFrequency: (value: BackupFrequency) => void;
}) {
  const { state, pending, status, issue } = backup;
  return (
    <section className="backup-settings" aria-label={tr("Sauvegarde Supabase")}>
      <h2>{tr("Synchronisation")}</h2>
      <p className="muted">
        {tr(
          "Vos goûts et votre collection sont sauvegardés sur votre compte à la fréquence choisie. Vos réglages sont synchronisés après modification.",
        )}
      </p>
      {connected ? (
        <>
          <label className="field">
            {tr("Fréquence de sauvegarde")}
            <select
              value={state.frequency}
              disabled={status === "syncing"}
              onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
            >
              <option value="daily">{tr("Une fois par jour")}</option>
              <option value="weekly">{tr("Une fois par semaine")}</option>
              <option value="manual">{tr("Manuelle uniquement")}</option>
            </select>
          </label>
          <p className="muted fine" aria-live="polite">
            {status === "syncing"
              ? tr("Sauvegarde en cours…")
              : issue
                ? issue.message
                : pending
                  ? tr("Modifications en attente de sauvegarde")
                  : state.lastSuccess
                    ? tr("Copie Supabase à jour")
                    : tr("Première sauvegarde à effectuer")}
            {state.lastSuccess
              ? ` · ${new Date(state.lastSuccess).toLocaleString(getLanguage(), { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
          <button
            className="button tonal"
            disabled={status === "syncing" || !backup.online}
            onClick={() => backup.syncNow()}
          >
            {status === "syncing"
              ? tr("Sauvegarde…")
              : tr("Sauvegarder maintenant")}
          </button>
        </>
      ) : (
        <button
          className="button tonal"
          onClick={signIn}
          disabled={!configured}
        >
          {tr("Se connecter pour synchroniser")}
        </button>
      )}
    </section>
  );
}

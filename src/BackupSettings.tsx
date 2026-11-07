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
    <section className="backup-settings" aria-label="Sauvegarde Supabase">
      <h2>Synchronisation</h2>
      <p className="muted">
        Vos goûts et votre collection sont sauvegardés sur votre compte à la
        fréquence choisie. Vos réglages sont synchronisés après modification.
      </p>
      {connected ? (
        <>
          <label className="field">
            Fréquence de sauvegarde
            <select
              value={state.frequency}
              disabled={status === "syncing"}
              onChange={(e) => setFrequency(e.target.value as BackupFrequency)}
            >
              <option value="daily">Une fois par jour</option>
              <option value="weekly">Une fois par semaine</option>
              <option value="manual">Manuelle uniquement</option>
            </select>
          </label>
          <p className="muted fine" aria-live="polite">
            {status === "syncing"
              ? "Sauvegarde en cours…"
              : issue
                ? issue.message
                : pending
                  ? "Modifications en attente de sauvegarde"
                  : state.lastSuccess
                    ? "Copie Supabase à jour"
                    : "Première sauvegarde à effectuer"}
            {state.lastSuccess
              ? ` · ${new Date(state.lastSuccess).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
              : ""}
          </p>
          <button
            className="button tonal"
            disabled={status === "syncing" || !backup.online}
            onClick={() => backup.syncNow()}
          >
            {status === "syncing" ? "Sauvegarde…" : "Sauvegarder maintenant"}
          </button>
        </>
      ) : (
        <button
          className="button tonal"
          onClick={signIn}
          disabled={!configured}
        >
          Se connecter pour synchroniser
        </button>
      )}
    </section>
  );
}

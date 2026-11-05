import { nextAutomaticAt, type BackupFrequency } from "./backup";
import type { BackupController } from "./useCloudBackup";
export default function BackupSettings({
  backup,
  connected,
  configured,
}: {
  backup: BackupController;
  connected: boolean;
  configured: boolean;
}) {
  const { state, pending, status, issue } = backup;
  const next = nextAutomaticAt(state);
  const stamp = (at: number) =>
    new Date(at).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <section className="backup-settings" aria-label="Sauvegarde Supabase">
      <span className="eyebrow">VOTRE COLLECTION À L’ABRI</span>
      <h2>Sauvegarde Supabase</h2>
      <p className="muted">
        Vos changements sont enregistrés immédiatement sur cet appareil. La
        copie Supabase est regroupée pour limiter les transferts : seuls les
        éléments nouveaux ou modifiés sont envoyés.
      </p>
      {connected ? (
        <>
          <label className="field">
            Fréquence de sauvegarde
            <select
              value={state.frequency}
              disabled={status === "syncing"}
              onChange={(e) =>
                backup.setFrequency(e.target.value as BackupFrequency)
              }
            >
              <option value="daily">Une fois par jour</option>
              <option value="weekly">Une fois par semaine</option>
              <option value="manual">Manuelle uniquement</option>
            </select>
          </label>
          <p className="muted fine">
            {state.frequency === "manual"
              ? "Aucune sauvegarde automatique dans ce mode."
              : `Au plus une sauvegarde automatique réussie ${state.frequency === "weekly" ? "tous les 7 jours" : "par période de 24 heures"} sur cet appareil.`}
            {state.frequency !== "manual" &&
              " Elle se fait pendant l’utilisation de Vela. Si l’app est fermée ou sans connexion, elle attend la prochaine ouverture avec Internet."}
          </p>
          <div className="backup-status" aria-live="polite">
            <strong>
              {status === "syncing"
                ? "Sauvegarde en cours…"
                : issue
                  ? "Sauvegarde à rétablir"
                  : pending
                    ? "Modifications en attente de sauvegarde"
                    : state.lastSuccess
                      ? "Copie Supabase à jour"
                      : "Première sauvegarde à effectuer"}
            </strong>
            <p className="muted">
              {state.lastSuccess
                ? `Dernière sauvegarde réussie : ${stamp(state.lastSuccess)}.`
                : "Aucune sauvegarde réussie pour ce compte sur cet appareil."}
            </p>
            {pending && (
              <p className="muted">
                Les changements en attente restent enregistrés sur cet appareil.
              </p>
            )}
            {next !== null && (
              <p className="muted">
                {next > Date.now()
                  ? `Prochain passage à partir du ${stamp(next)}, pendant l’utilisation de Vela.`
                  : "Prochain passage dès que Vela est ouvert avec une connexion."}
              </p>
            )}
            {!backup.online && (
              <p className="muted">
                Hors connexion : la copie locale reste disponible.
              </p>
            )}
            {issue && <p className="muted">{issue.message}</p>}
          </div>
          <button
            className="button tonal"
            disabled={status === "syncing" || !backup.online}
            onClick={() => backup.syncNow()}
          >
            {status === "syncing" ? "Sauvegarde…" : "Sauvegarder maintenant"}
          </button>
          <p className="muted fine">
            La sauvegarde manuelle reste disponible à tout moment. En cas
            d’échec réseau, les nouvelles tentatives sont espacées. Cette copie
            synchronisée conserve le dernier état ; l’export JSON du profil
            permet de garder une archive datée.
          </p>
        </>
      ) : (
        <p className="muted">
          {configured
            ? "Connectez-vous depuis Profil pour activer la sauvegarde quotidienne de votre compte."
            : "Configurez Supabase ci-dessous puis connectez-vous depuis Profil. La sauvegarde quotidienne sera proposée par défaut."}
        </p>
      )}
    </section>
  );
}

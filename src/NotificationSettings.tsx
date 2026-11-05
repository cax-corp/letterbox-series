import { useEffect, useRef, useState } from "react";
import type { Entry } from "./store";
import type { Title } from "./catalog";
import {
  dailyNative,
  dailySupported,
  defaultDaily,
  setDailyRecommendations,
  buildDailyPayload,
  type DailyState,
} from "./notifications";
import { Bell } from "./icons";
import { Clipboard } from "@capacitor/clipboard";
export default function NotificationSettings({
  library,
  fallback,
  account = "local",
}: {
  library: Record<string, Entry>;
  fallback: Title[];
  account?: string;
}) {
  const supported = dailySupported();
  const busyRef = useRef(false),
    dirty = useRef(false),
    revision = useRef(0);
  const [state, setState] = useState<DailyState | null>(null),
    [time, setTime] = useState("19:00"),
    [days, setDays] = useState(defaultDaily.days),
    [reliable, setReliable] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!supported) return;
    let active = true;
    const load = () => {
      const id = ++revision.current;
      return dailyNative
        .getState()
        .then((s) => {
          if (!active || busyRef.current || id !== revision.current) return;
          setState(s);
          if (!dirty.current) {
            setTime(
              `${String(s.config.hour ?? 19).padStart(2, "0")}:${String(s.config.minute ?? 0).padStart(2, "0")}`,
            );
            setDays(s.config.days || defaultDaily.days);
            setReliable(s.config.reliableAlarm ?? false);
          }
        })
        .catch(() => {
          if (active) setMessage("Le réglage Android ne peut pas être chargé.");
        });
    };
    load();
    const resume = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", resume);
    const poll = window.setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", resume);
      clearInterval(poll);
    };
  }, [supported]);
  async function save(enabled: boolean) {
    busyRef.current = true;
    ++revision.current;
    setBusy(true);
    setMessage("");
    try {
      const [hour, minute] = enabled
        ? time.split(":").map(Number)
        : [state?.config.hour ?? 19, state?.config.minute ?? 0];
      const result = await setDailyRecommendations(
        {
          enabled,
          reliableAlarm: reliable,
          hour,
          minute,
          days: !enabled && !days.length ? defaultDaily.days : days,
        },
        library,
        fallback,
        dailyNative,
        account,
      );
      dirty.current = false;
      setState(result);
      setMessage(
        enabled
          ? result.exactAllowed === false
            ? "Horaire enregistré. Autorisez les horaires précis pour éviter un retard."
            : "Les recommandations sont programmées."
          : "Les notifications sont désactivées.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Le réglage n’a pas pu être enregistré.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function testBackground(immediate = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    ++revision.current;
    setBusy(true);
    setMessage("");
    try {
      const permission = await dailyNative.requestNotificationPermission();
      if (!permission.granted)
        throw new Error(
          "Autorisez les notifications dans Android pour lancer le test.",
        );
      const context = buildDailyPayload(
        { ...defaultDaily, ...state?.config, reliableAlarm: reliable },
        library,
        fallback,
        account,
      );
      const result = await dailyNative.testNotification!({
        context,
        immediate,
      });
      setState(result);
      setMessage(
        immediate
          ? result.lastStatus === "posted"
            ? "Test transmis à Android. Vérifiez le panneau des notifications."
            : "Android n’a pas publié le test. Consultez le diagnostic ci-dessous."
          : "Test programmé. Fermez Vela puis consultez vos notifications dans environ une minute. Autorisez les horaires précis pour éviter un retard.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Le test ne peut pas être programmé.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function copyDiagnostic() {
    try {
      const fresh = await dailyNative.getState();
      setState(fresh);
      // No catalogue, account, watched history or API keys in this shareable report.
      const { config, reserveCount, ...diagnostic } = fresh;
      await Clipboard.write({
        string: JSON.stringify(
          {
            app: "Vela 2.0.0",
            capturedAt: new Date().toISOString(),
            schedule: {
              enabled: config.enabled,
              hour: config.hour,
              minute: config.minute,
              days: config.days,
              reliableAlarm: config.reliableAlarm,
            },
            ...diagnostic,
          },
          null,
          2,
        ),
      });
      setMessage(
        "Diagnostic copié. Vous pouvez le coller dans la conversation.",
      );
    } catch {
      setMessage("Le diagnostic ne peut pas être copié.");
    }
  }
  const stamp = (at: number) => new Date(at).toLocaleString("fr-FR");
  const pending = state?.testAt && state.testAt > Date.now();
  const method = (value?: string) =>
    value === "alarm_clock"
      ? "Réveil Android (renforcé)"
      : value === "exact"
        ? "Alarme précise"
        : value === "inexact"
          ? "Alarme approximative"
          : "Aucune alarme enregistrée";
  return (
    <section className="notification-settings">
      <span className="eyebrow">
        <Bell size={16} />
        UNE IDÉE AU BON MOMENT
      </span>
      <h2>Votre rendez-vous cinéma</h2>
      {supported ? (
        <>
          <p className="muted">
            Recevez une idée de film à l’heure et aux jours de votre choix, même
            quand Vela est fermé.
          </p>
          <label className="field">
            Heure de la recommandation
            <input
              type="time"
              required
              value={time}
              onChange={(e) => {
                dirty.current = true;
                setTime(e.target.value);
              }}
            />
          </label>
          <div
            className="notification-days"
            role="group"
            aria-label="Jours des notifications"
          >
            {[
              [1, "Lun"],
              [2, "Mar"],
              [3, "Mer"],
              [4, "Jeu"],
              [5, "Ven"],
              [6, "Sam"],
              [0, "Dim"],
            ].map(([day, label]) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(Number(day))}
                onClick={() => {
                  dirty.current = true;
                  setDays((current) =>
                    current.includes(Number(day))
                      ? current.filter((d) => d !== Number(day))
                      : [...current, Number(day)],
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="notification-reliable">
            <input
              type="checkbox"
              checked={reliable}
              onChange={(e) => {
                dirty.current = true;
                setReliable(e.target.checked);
              }}
            />
            <span>
              <strong>Fiabilité renforcée</strong>
              <small>
                Utilise le réveil Android pour sortir de la veille. Une icône de
                réveil peut apparaître dans la barre d’état. Aucune sonnerie :
                seule la notification est publiée. Enregistrez pour appliquer ce
                choix au rendez-vous quotidien.
              </small>
            </span>
          </label>
          {state?.xiaomi && (
            <div className="notification-xiaomi">
              <strong>Sur Xiaomi / HyperOS</strong>
              <p className="muted">
                L’économiseur Xiaomi peut empêcher Vela de se réveiller, même si
                les notifications sont autorisées. Activez le démarrage
                automatique et testez la fiabilité renforcée. Si le test reste
                bloqué, sélectionnez « Pas de restriction » pour Vela uniquement
                ; vous pouvez garder l’économiseur général du téléphone.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  dailyNative
                    .openAutoStartSettings?.()
                    .catch(() =>
                      setMessage(
                        "Ouvrez Paramètres → Applications → Autorisations → Démarrage automatique, puis activez Vela.",
                      ),
                    )
                }
              >
                Autoriser le démarrage automatique Xiaomi ↗
              </button>
              <button
                className="text-button"
                onClick={() =>
                  dailyNative
                    .openBackgroundSettings?.()
                    .catch(() =>
                      setMessage(
                        "Ouvrez les informations de Vela → Batterie → Pas de restriction.",
                      ),
                    )
                }
              >
                Régler la batterie de Vela ↗
              </button>
              <p className="muted fine">
                Android ne permet pas à Vela de vérifier automatiquement ces
                deux réglages propres à Xiaomi.
              </p>
            </div>
          )}
          {state?.config.enabled && !state.granted && (
            <p className="muted fine" role="status">
              Les notifications sont bloquées dans Android.
            </p>
          )}
          {state?.config.enabled && state.granted && state.nextAt > 0 && (
            <p className="muted fine">
              Prochaine recommandation :{" "}
              {new Date(state.nextAt).toLocaleString("fr-FR", {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          )}
          <div className="notification-buttons">
            <button
              className="button primary"
              disabled={busy || !time || !days.length}
              onClick={() => save(true)}
            >
              {busy
                ? "Enregistrement…"
                : state?.config.enabled
                  ? "Enregistrer l’horaire"
                  : "Activer les recommandations"}
            </button>
            {state?.config.enabled && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => save(false)}
              >
                Désactiver
              </button>
            )}
          </div>
          <div className="notification-diagnostics">
            <p className="muted">
              Les idées sont préparées à l’avance. À l’heure choisie, Android
              déclenche uniquement le rappel, même sans connexion. Les
              restrictions du fabricant peuvent toutefois empêcher son
              exécution.
            </p>
            {typeof state?.reserveCount === "number" && (
              <p className="muted">
                {state.reserveCount} film{state.reserveCount > 1 ? "s" : ""} en
                réserve. Si elle est épuisée, un rappel vous invitera à ouvrir
                Pour vous.
              </p>
            )}
            {state?.exactAllowed === false && (
              <>
                <p className="muted">
                  Les horaires sont approximatifs tant que l’autorisation
                  Android « Alarmes et rappels » est désactivée.
                </p>
                <button
                  className="text-button"
                  onClick={() =>
                    dailyNative
                      .openExactAlarmSettings?.()
                      .catch(() =>
                        setMessage(
                          "Ouvrez Alarmes et rappels dans les paramètres Android de Vela.",
                        ),
                      )
                  }
                >
                  Autoriser les horaires précis ↗
                </button>
              </>
            )}
            {state?.backgroundRestricted && (
              <p className="muted">
                Android limite actuellement l’activité de Vela en arrière-plan.
                Vérifiez son réglage de batterie.
              </p>
            )}
            {state?.lastSentAt ? (
              <p className="muted">
                Dernière publication dans Android :{" "}
                {new Date(state.lastSentAt).toLocaleString("fr-FR")}.
              </p>
            ) : null}
            {state?.testAt && state.testAt > Date.now() ? (
              <p className="muted">
                Test prévu à{" "}
                {new Date(state.testAt).toLocaleTimeString("fr-FR")}.
              </p>
            ) : null}
            <button
              className="button tonal"
              disabled={busy}
              onClick={() => testBackground(false)}
            >
              Tester dans 1 minute
            </button>
            <button
              className="button tonal"
              disabled={busy}
              onClick={() => testBackground(true)}
            >
              Tester maintenant
            </button>
            <details className="notification-report">
              <summary>Diagnostic du dernier rappel</summary>
              <p className="muted">
                Programmation quotidienne : {method(state?.alarmMethod)}.
                {pending ? ` Test : ${method(state?.testAlarmMethod)}.` : ""}
              </p>
              {state?.lastMissedAt ? (
                <p className="muted">
                  Retard constaté à la réouverture : {stamp(state.lastMissedAt)}
                  {state.lastMissedTest ? " (test)" : ""}. Le rappel n’avait pas
                  abouti à l’heure prévue.
                </p>
              ) : null}
              {state?.lastAttemptAt ? (
                <>
                  <p className="muted">
                    Dernier déclenchement : {stamp(state.lastAttemptAt)}
                    {state.lastAttemptTest ? " (test)" : ""}.
                    {state.lastSource === "immediate"
                      ? " Test au premier plan."
                      : state.lastSource === "backup"
                        ? " Via le relais de secours Android."
                        : " Via l’alarme Android."}
                  </p>
                  {state.lastAttemptDue ? (
                    <p className="muted">
                      Horaire attendu : {stamp(state.lastAttemptDue)}.
                    </p>
                  ) : null}
                  <p className="muted">
                    {state.lastStatus === "posted"
                      ? "Notification transmise à Android. Cela ne garantit pas son affichage par Xiaomi."
                      : state.lastStatus === "blocked" ||
                          state.lastStatus === "permission_error"
                        ? "Android a bloqué les notifications. Vérifiez les autorisations et la catégorie Recommandations Vela."
                        : "La publication n’a pas abouti."}
                  </p>
                </>
              ) : (
                <p className="muted">
                  Aucun déclenchement enregistré. Lancez le test dans une
                  minute, fermez Vela puis revenez consulter cet état.
                </p>
              )}
              {state?.notificationActive && (
                <p className="muted">
                  Une notification Vela est actuellement présente dans Android.
                </p>
              )}
              <p className="muted">
                Économiseur général :{" "}
                {state?.batterySaver ? "activé" : "désactivé"}.
                {state?.batteryExempt === false
                  ? " Optimisation Android active ; ce statut ne décrit pas le réglage Xiaomi."
                  : ""}
              </p>
              <button className="text-button" onClick={copyDiagnostic}>
                Copier le diagnostic
              </button>
            </details>
            <button
              className="text-button"
              onClick={() =>
                dailyNative
                  .openBackgroundSettings?.()
                  .catch(() =>
                    setMessage(
                      "Ouvrez les informations de Vela dans Android, puis Batterie.",
                    ),
                  )
              }
            >
              Vérifier la batterie dans Android ↗
            </button>
            <p className="muted fine">
              Heure locale du téléphone. Un « arrêt forcé » depuis les
              paramètres Android suspend les rappels jusqu’à la réouverture.
            </p>
          </div>
          <button
            className="text-button"
            onClick={() =>
              dailyNative
                .openSettings()
                .catch(() =>
                  setMessage(
                    "Ouvrez les paramètres de notifications Android pour Vela.",
                  ),
                )
            }
          >
            Notifications dans Android ↗
          </button>
          {message && (
            <p className="muted" role="status">
              {message}
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          Les notifications programmées sont disponibles dans l’APK Android. Le
          site web seul ne peut pas envoyer ce rendez-vous lorsque le navigateur
          est fermé.
        </p>
      )}
    </section>
  );
}

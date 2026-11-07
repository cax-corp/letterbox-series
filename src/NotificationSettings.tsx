import { t as tr, getLanguage } from "./i18n";
import { useEffect, useRef, useState } from "react";
import type { Entry } from "./store";
import type { Title } from "./catalog";
import {
  dailyNative,
  dailySupported,
  defaultDaily,
  setDailyRecommendations,
  type DailyState,
} from "./notifications";
import {
  defaultNotificationPreference,
  type NotificationPreference,
} from "./account-state";
export default function NotificationSettings({
  library,
  fallback,
  account = "local",
  preference,
  savePreference,
}: {
  library: Record<string, Entry>;
  fallback: Title[];
  account?: string;
  preference?: NotificationPreference;
  savePreference: (value: NotificationPreference) => void;
}) {
  const supported = dailySupported(),
    dirty = useRef(false);
  const [state, setState] = useState<DailyState | null>(null),
    [draft, setDraft] = useState<NotificationPreference>(
      preference || defaultNotificationPreference,
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!dirty.current && preference) setDraft(preference);
  }, [JSON.stringify(preference)]);
  useEffect(() => {
    if (!supported) return;
    let live = true;
    const load = () =>
      dailyNative
        .getState()
        .then((value) => {
          if (!live) return;
          setState(value);
          if (!dirty.current && !preference)
            setDraft({ ...defaultNotificationPreference, ...value.config });
        })
        .catch(() => {
          if (live)
            setMessage(tr("Le réglage Android ne peut pas être chargé."));
        });
    void load();
    const resume = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", resume);
    };
  }, [supported, JSON.stringify(preference), account]);
  const patch = (value: Partial<NotificationPreference>) => {
    dirty.current = true;
    setDraft((old) => ({ ...old, ...value }));
  };
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const wanted: NotificationPreference = {
        enabled: draft.enabled,
        hour: draft.hour,
        minute: draft.minute,
        days: draft.days.length ? draft.days : defaultDaily.days,
      };
      if (supported)
        setState(
          await setDailyRecommendations(
            { ...wanted, reliableAlarm: false },
            library,
            fallback,
            dailyNative,
            account,
          ),
        );
      savePreference(wanted);
      setDraft(wanted);
      dirty.current = false;
      setMessage(
        draft.enabled
          ? tr("Horaire enregistré.")
          : tr("Les notifications sont désactivées."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tr("Le réglage n’a pas pu être enregistré."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notification-settings" aria-label="Notifications">
      <h2>Notifications</h2>
      <p className="muted">
        {tr(
          "Une recommandation aux jours et à l’heure de votre choix, dans l’application Android.",
        )}
      </p>
      <label className="setting-switch">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        {tr("Recevoir une recommandation")}
      </label>
      <label className="field">
        {tr("Heure de la recommandation")}
        <input
          type="time"
          required
          value={`${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`}
          onChange={(e) => {
            if (e.target.value) {
              const [hour, minute] = e.target.value.split(":").map(Number);
              patch({ hour, minute });
            }
          }}
        />
      </label>
      <div
        className="notification-days"
        role="group"
        aria-label={tr("Jours des notifications")}
      >
        {[
          [1, tr("Lun")],
          [2, tr("Mar")],
          [3, tr("Mer")],
          [4, tr("Jeu")],
          [5, tr("Ven")],
          [6, tr("Sam")],
          [0, tr("Dim")],
        ].map(([day, label]) => (
          <button
            key={day}
            type="button"
            aria-pressed={draft.days.includes(Number(day))}
            onClick={() =>
              patch({
                days: draft.days.includes(Number(day))
                  ? draft.days.filter((d) => d !== Number(day))
                  : [...draft.days, Number(day)].sort(),
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <button
        className="button primary"
        disabled={busy || (draft.enabled && !draft.days.length)}
        onClick={save}
      >
        {busy ? tr("Enregistrement…") : tr("Enregistrer l’horaire")}
      </button>
      {supported && draft.enabled && state && !state.granted && (
        <>
          <p className="muted" role="status">
            {tr("Autorisez les notifications sur ce téléphone.")}
          </p>
          <button
            className="text-button"
            onClick={() =>
              dailyNative
                .openSettings()
                .catch(() =>
                  setMessage(
                    tr(
                      "Ouvrez les paramètres de notifications Android de Vela.",
                    ),
                  ),
                )
            }
          >
            {tr("Notifications dans Android ↗")}
          </button>
        </>
      )}
      {supported &&
        state?.config.enabled &&
        state.granted &&
        state.nextAt > 0 && (
          <p className="muted fine">
            {tr("Prochaine recommandation :")}{" "}
            {new Date(state.nextAt).toLocaleString(getLanguage(), {
              weekday: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        )}
      {supported && state?.exactAllowed === false && (
        <button
          className="text-button"
          onClick={() =>
            dailyNative
              .openExactAlarmSettings?.()
              .catch(() =>
                setMessage(
                  tr(
                    "Ouvrez Alarmes et rappels dans les paramètres Android de Vela.",
                  ),
                ),
              )
          }
        >
          {tr("Autoriser les horaires précis ↗")}
        </button>
      )}
      <p className="muted fine">
        {tr("Heure locale de chaque appareil.")}{" "}
        {supported
          ? tr("Les rappels fonctionnent aussi lorsque Vela est fermé.")
          : tr(
              "Cet horaire sera repris dans l’application Android après connexion au même compte.",
            )}
      </p>
      {message && (
        <p className="muted" role="status">
          {tr(message)}
        </p>
      )}
    </section>
  );
}

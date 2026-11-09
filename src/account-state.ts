import { t as tr } from "./i18n";
import { cloud, getConfig } from "./store";
import { getColourTheme } from "./colour-themes";
import {
  exportSkipArchive,
  mergeSkipArchive,
  type StoredSkip,
} from "./implicit-feedback";
export type NotificationPreference = {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
};
export type PreferenceValues = {
  palette: string;
  theme: "dark" | "light" | "system";
  backupFrequency: "daily" | "weekly" | "manual";
  notifications: NotificationPreference;
};
export type PreferenceName = keyof PreferenceValues;
export type PreferenceRecord = {
  key: PreferenceName;
  payload: { value: PreferenceValues[PreferenceName] };
  updated_at: string;
  synced?: boolean;
};
export type AccountPreferences = Partial<
  Record<PreferenceName, PreferenceRecord>
>;
export const defaultNotificationPreference: NotificationPreference = {
  enabled: false,
  hour: 19,
  minute: 0,
  days: [0, 1, 2, 3, 4, 5, 6],
};
export const accountStateKey = (account: string, project = getConfig().url) =>
  `vela-account-state-v1:${encodeURIComponent(project || "local")}:${account}`;
const fields: PreferenceName[] = [
  "palette",
  "theme",
  "backupFrequency",
  "notifications",
];
export function validPreference(key: string, value: unknown): boolean {
  if (key === "palette")
    return typeof value === "string" && getColourTheme(value).id === value;
  if (key === "theme")
    return ["dark", "light", "system"].includes(String(value));
  if (key === "backupFrequency")
    return ["daily", "weekly", "manual"].includes(String(value));
  if (key === "notifications") {
    const v = value as NotificationPreference;
    return Boolean(
      v &&
      typeof v.enabled === "boolean" &&
      Number.isInteger(v.hour) &&
      v.hour >= 0 &&
      v.hour <= 23 &&
      Number.isInteger(v.minute) &&
      v.minute >= 0 &&
      v.minute <= 59 &&
      Array.isArray(v.days) &&
      v.days.length > 0 &&
      v.days.length <= 7 &&
      new Set(v.days).size === v.days.length &&
      v.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    );
  }
  return false;
}
function validRecord(row: unknown): row is PreferenceRecord {
  const r = row as PreferenceRecord;
  return Boolean(
    r &&
    fields.includes(r.key) &&
    Number.isFinite(Date.parse(r.updated_at)) &&
    validPreference(r.key, r.payload?.value),
  );
}
export function readAccountPreferences(account: string): AccountPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(accountStateKey(account)) || "{}",
    );
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, row]) =>
          validRecord(row) && (row as PreferenceRecord).key === key,
      ),
    ) as AccountPreferences;
  } catch {
    return {};
  }
}
function save(account: string, value: AccountPreferences) {
  localStorage.setItem(accountStateKey(account), JSON.stringify(value));
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("vela-account-state", { detail: account }),
    );
}
export function changePreference<K extends PreferenceName>(
  account: string,
  key: K,
  value: PreferenceValues[K],
) {
  if (!validPreference(key, value)) throw new Error(tr("Réglage invalide."));
  const current = readAccountPreferences(account);
  if (JSON.stringify(current[key]?.payload.value) === JSON.stringify(value))
    return;
  current[key] = {
    key,
    payload: { value },
    updated_at: new Date(
      Math.max(Date.now(), Date.parse(current[key]?.updated_at || "") + 1 || 0),
    ).toISOString(),
    synced: false,
  };
  save(account, current);
}
export function mergePreferenceRecords(
  local: AccountPreferences,
  remote: unknown[],
): AccountPreferences {
  const next = { ...local };
  for (const row of remote) {
    if (!validRecord(row)) continue;
    const old = next[row.key];
    if (!old || Date.parse(row.updated_at) >= Date.parse(old.updated_at))
      next[row.key] = { ...row, synced: true };
  }
  return next;
}
type PrivateRow = { key: string; payload: any; updated_at: string };
const flights = new Map<string, Promise<AccountPreferences>>();
/** Private data stays in RLS-protected rows, never in public shares or authentication tokens. */
export async function syncAccountState(
  account: string,
  includeTastes = false,
  readOnly = false,
): Promise<AccountPreferences> {
  if (!cloud || account === "local") return readAccountPreferences(account);
  const flightKey = `${accountStateKey(account)}:${includeTastes}:${readOnly}`;
  const existing = flights.get(flightKey);
  if (existing) return existing;
  const job = (async () => {
    const { data, error } = await cloud.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (session?.user.id !== account) return readAccountPreferences(account);
    const config = getConfig(),
      controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const headers = {
      apikey: config.key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    async function request(
      path: string,
      body?: unknown,
    ): Promise<PrivateRow[]> {
      const response = await fetch(`${config.url}/rest/v1/${path}`, {
        method: body ? "POST" : "GET",
        headers,
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.code === "42P01" ||
            result.code === "PGRST205" ||
            result.code === "PGRST202"
            ? tr(
                "La synchronisation des réglages nécessite la mise à jour Supabase fournie avec Vela.",
              )
            : result.message ||
                tr("Synchronisation des réglages indisponible."),
        );
      if (!Array.isArray(result))
        throw new Error(tr("Réponse de synchronisation invalide."));
      return result;
    }
    try {
      const tastesStampKey = `${accountStateKey(account)}:tastes-read`;
      let lastTasteRead = 0;
      try {
        lastTasteRead = Number(localStorage.getItem(tastesStampKey) || 0);
      } catch {}
      const readTastes =
        includeTastes || (readOnly && Date.now() - lastTasteRead > 10 * 60000);
      const remote = await request(
        `vela_private_state?user_id=eq.${encodeURIComponent(account)}&select=key,payload,updated_at&limit=200${!readTastes ? "&key=in.(palette,theme,backupFrequency,notifications)" : ""}`,
      );
      const merged = mergePreferenceRecords(
        readAccountPreferences(account),
        remote,
      );
      save(account, merged);
      mergeSkipArchive(
        account,
        remote.filter((r) => r.key.startsWith("skip:")).map((r) => r.payload),
      );
      if (readTastes)
        try {
          localStorage.setItem(tastesStampKey, String(Date.now()));
        } catch {}
      const outgoing: PrivateRow[] = [];
      if (!readOnly) {
        for (const row of Object.values(merged))
          if (row && !row.synced)
            outgoing.push({
              key: row.key,
              payload: row.payload,
              updated_at: row.updated_at,
            });
        if (includeTastes)
          for (const skip of exportSkipArchive(account)) {
            const key = `skip:${skip.title.id}`,
              old = remote.find((row) => row.key === key);
            if (!old || Date.parse(old.updated_at) < skip.at)
              outgoing.push({
                key,
                payload: skip,
                updated_at: new Date(skip.at).toISOString(),
              });
          }
      }
      if (!outgoing.length) return merged;
      const result = await request("rpc/vela_merge_private_state", {
        items: outgoing,
      });
      // Re-read local changes: a newer edit made during the request stays pending.
      const confirmed = mergePreferenceRecords(
        readAccountPreferences(account),
        result,
      );
      for (const sent of outgoing)
        if (fields.includes(sent.key as PreferenceName)) {
          const ack = result.find((r) => r.key === sent.key);
          if (!ack || Date.parse(ack.updated_at) < Date.parse(sent.updated_at))
            throw new Error(tr("Un réglage n’a pas pu être confirmé."));
        }
      save(account, confirmed);
      mergeSkipArchive(
        account,
        result.filter((r) => r.key.startsWith("skip:")).map((r) => r.payload),
      );
      return confirmed;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => flights.delete(flightKey));
  flights.set(flightKey, job);
  return job;
}
export type { StoredSkip };

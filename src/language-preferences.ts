import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud, getConfig } from "./store";
import {
  getLanguage,
  setAppLanguage,
  t,
  validLanguage,
  type AppLanguage,
} from "./i18n";
export type LanguagePreference = {
  version: 1;
  code: AppLanguage;
  updated: string;
};
const key = (account: string) =>
  `vela-language-v1:${getConfig().url || "local"}:${account}`;
export function validateLanguagePreference(
  v: unknown,
): LanguagePreference | null {
  const p = v as LanguagePreference;
  return p?.version === 1 &&
    validLanguage(p.code) &&
    Number.isFinite(Date.parse(p.updated))
    ? { version: 1, code: p.code, updated: p.updated }
    : null;
}
export function readLanguagePreference(account: string, metadata?: unknown) {
  let local: LanguagePreference | null = null;
  try {
    local = validateLanguagePreference(
      JSON.parse(localStorage.getItem(key(account)) || "null"),
    );
  } catch {}
  const remote = validateLanguagePreference(metadata);
  return remote &&
    (!local || Date.parse(remote.updated) >= Date.parse(local.updated))
    ? remote
    : local;
}
function persist(account: string, value: LanguagePreference) {
  localStorage.setItem(key(account), JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent("vela-language-state", { detail: account }),
  );
}
const flights = new Map<string, Promise<void>>();
export function syncLanguagePreference(account: string): Promise<void> {
  if (!cloud || account === "local") return Promise.resolve();
  const flightKey = key(account),
    old = flights.get(flightKey);
  if (old) return old;
  const job = (async () => {
    const { data, error } = await cloud!.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (session?.user.id !== account) return;
    const result = await cloud!.auth.getUser(session.access_token);
    if (result.error) throw result.error;
    if (result.data.user?.id !== account) return;
    let remote = validateLanguagePreference(
      result.data.user.user_metadata?.vela_language,
    );
    for (let i = 0; i < 4; i++) {
      const chosen = readLanguagePreference(account, remote);
      if (!chosen) break;
      persist(account, chosen);
      if (remote && Date.parse(remote.updated) >= Date.parse(chosen.updated))
        break;
      const config = getConfig();
      const response = await fetch(`${config.url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: config.key,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ data: { vela_language: chosen } }),
      });
      const saved = await response.json();
      if (!response.ok || saved.id !== account)
        throw new Error(
          t(
            "La langue reste enregistrée sur cet appareil. Réessayez la synchronisation.",
          ),
        );
      remote = validateLanguagePreference(saved.user_metadata?.vela_language);
      if (
        !remote ||
        remote.code !== chosen.code ||
        remote.updated !== chosen.updated
      )
        throw new Error(t("La langue n’a pas pu être confirmée par Supabase."));
    }
  })().finally(() => flights.delete(flightKey));
  flights.set(flightKey, job);
  return job;
}
export function saveGuestLanguage(code: AppLanguage) {
  persist("local", { version: 1, code, updated: new Date().toISOString() });
  setAppLanguage(code);
}
export function useLanguagePreference(user: User | null) {
  const account = user?.id || "local";
  const [status, setStatus] = useState({ account, busy: false, error: "" });
  const language =
    readLanguagePreference(account, user?.user_metadata?.vela_language)?.code ||
    "fr-FR";
  useEffect(() => {
    let live = true,
      lastRead = 0;
    const apply = () => {
      if (live)
        setAppLanguage(
          readLanguagePreference(account, user?.user_metadata?.vela_language)
            ?.code || "fr-FR",
        );
    };
    const changed = (e: Event) => {
      if ((e as CustomEvent).detail === account) apply();
    };
    const restore = () => {
      if (!user || navigator.onLine === false) return;
      lastRead = Date.now();
      void syncLanguagePreference(account)
        .then(() => {
          if (live) setStatus({ account, busy: false, error: "" });
        })
        .catch(() => {
          if (live)
            setStatus({
              account,
              busy: false,
              error:
                "La langue reste enregistrée sur cet appareil. Réessayez la synchronisation.",
            });
        });
    };
    const resume = () => {
      if (!document.hidden && Date.now() - lastRead > 60000) restore();
    };
    apply();
    setStatus({ account, busy: false, error: "" });
    restore();
    window.addEventListener("vela-language-state", changed);
    window.addEventListener("online", restore);
    window.addEventListener("storage", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      live = false;
      window.removeEventListener("vela-language-state", changed);
      window.removeEventListener("online", restore);
      window.removeEventListener("storage", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [account, user?.user_metadata?.vela_language]);
  async function save(code: AppLanguage) {
    const previous = readLanguagePreference(
      account,
      user?.user_metadata?.vela_language,
    );
    try {
      persist(account, {
        version: 1,
        code,
        updated: new Date(
          Math.max(Date.now(), Date.parse(previous?.updated || "") + 1 || 0),
        ).toISOString(),
      });
      setAppLanguage(code);
    } catch {
      setStatus({
        account,
        busy: false,
        error: "Le stockage de cet appareil est plein.",
      });
      return;
    }
    if (!user) return;
    setStatus({ account, busy: true, error: "" });
    try {
      await syncLanguagePreference(account);
      setStatus({ account, busy: false, error: "" });
    } catch {
      setStatus({
        account,
        busy: false,
        error:
          "La langue reste enregistrée sur cet appareil. Réessayez la synchronisation.",
      });
    }
  }
  return {
    language,
    save,
    busy: status.account === account && status.busy,
    error: status.account === account ? status.error : "",
  };
}

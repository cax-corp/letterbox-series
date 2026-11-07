import { t as tr } from "./i18n";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { backupService } from "./backup";
import {
  accountStateKey,
  changePreference,
  readAccountPreferences,
  syncAccountState,
  type PreferenceValues,
  type PreferenceName,
  type AccountPreferences,
} from "./account-state";
export function useAccountSettings(
  user: User | null,
  apply: (preferences: Partial<PreferenceValues>) => void,
  initial: Pick<PreferenceValues, "palette" | "theme" | "backupFrequency">,
) {
  const account = user?.id || "local",
    active = useRef(account),
    handler = useRef(apply);
  active.current = account;
  handler.current = apply;
  const retryHandler = useRef<() => void>(() => {});
  const [record, setRecord] = useState<{
    account: string;
    values: AccountPreferences;
    ready: boolean;
    error: string;
  }>({
    account,
    values: readAccountPreferences(account),
    ready: !user,
    error: "",
  });
  useEffect(() => {
    let live = true,
      syncing = false,
      retryAt = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const defaults = initial;
    const current = () => live && active.current === account;
    const render = () => {
      if (!current()) return;
      const values = readAccountPreferences(account);
      const prefs = Object.fromEntries(
        Object.entries(values).map(([key, row]) => [key, row?.payload.value]),
      ) as Partial<PreferenceValues>;
      if (
        prefs.backupFrequency &&
        backupService.state(account).frequency !== prefs.backupFrequency
      )
        backupService.setFrequency(account, prefs.backupFrequency);
      handler.current(prefs);
      setRecord((old) => ({
        account,
        values,
        ready: old.account === account ? old.ready : false,
        error:
          Object.values(values).some((row) => row && !row.synced) &&
          old.account === account
            ? old.error
            : "",
      }));
    };
    const sync = async (readOnly = false) => {
      if (syncing || Date.now() < retryAt || !current()) return false;
      if (!user || navigator.onLine === false) {
        if (current()) setRecord((old) => ({ ...old, account, ready: true }));
        return false;
      }
      syncing = true;
      try {
        await syncAccountState(account, false, readOnly);
        if (current())
          setRecord((old) => ({ ...old, account, ready: true, error: "" }));
        retryAt = 0;
        return true;
      } catch (error) {
        retryAt = Date.now() + 60000;
        if (current())
          setRecord((old) => ({
            ...old,
            account,
            ready: true,
            error:
              error instanceof Error
                ? error.message
                : tr("Synchronisation des réglages indisponible."),
          }));
        return false;
      } finally {
        syncing = false;
      }
    };
    const schedule = () => {
      render();
      clearTimeout(timer);
      if (
        user &&
        !syncing &&
        Date.now() >= retryAt &&
        Object.values(readAccountPreferences(account)).some(
          (row) => row && !row.synced,
        )
      )
        timer = setTimeout(() => {
          void sync().then((ok) => {
            if (ok) schedule();
          });
        }, 2500);
    };
    retryHandler.current = () => {
      retryAt = 0;
      void sync().then(schedule);
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === account) schedule();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === accountStateKey(account)) schedule();
    };
    let wasHidden = document.hidden,
      lastPull = Date.now();
    const resume = () => {
      if (document.hidden) wasHidden = true;
      else if (wasHidden) {
        wasHidden = false;
        if (Date.now() - lastPull > 30000) {
          lastPull = Date.now();
          void sync(true).then(schedule);
        }
      }
    };
    const online = () => {
      schedule();
      if (
        !Object.values(readAccountPreferences(account)).some(
          (row) => row && !row.synced,
        )
      )
        void sync(true);
    };
    setRecord({
      account,
      values: readAccountPreferences(account),
      ready: !user,
      error: "",
    });
    render();
    window.addEventListener("vela-account-state", changed);
    window.addEventListener("storage", storage);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", resume);
    if (user)
      void sync(true).then((ok) => {
        if (ok && current()) {
          const local = readAccountPreferences(account);
          for (const key of ["palette", "theme", "backupFrequency"] as const)
            if (!local[key]) changePreference(account, key, defaults[key]);
        }
        schedule();
      });
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener("vela-account-state", changed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("online", online);
      retryHandler.current = () => {};
      document.removeEventListener("visibilitychange", resume);
    };
  }, [account]);
  const values =
    record.account === account
      ? record.values
      : readAccountPreferences(account);
  function change<K extends PreferenceName>(
    key: K,
    value: PreferenceValues[K],
  ) {
    changePreference(account, key, value);
  }
  return {
    values: Object.fromEntries(
      Object.entries(values).map(([key, row]) => [key, row?.payload.value]),
    ) as Partial<PreferenceValues>,
    change,
    ready: !user || (record.account === account && record.ready),
    error: record.account === account ? record.error : "",
    pending: Object.values(values).some((row) => row && !row.synced),
    retry: () => retryHandler.current(),
  };
}

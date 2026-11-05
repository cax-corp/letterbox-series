import { useEffect, useMemo, useRef, useState } from "react";
import {
  automaticDue,
  backupKey,
  backupService,
  cloudAvailable,
  defaultBackup,
  type BackupFrequency,
  type BackupState,
} from "./backup";
import { getConfig, read, type Library } from "./store";
import { readCurrentProfile } from "./profile-sync";
import { profileKey, profilePending } from "./profile";
import { explainSyncError, type SyncIssue } from "./sync-errors";
export function useCloudBackup(
  account: string | undefined,
  onLibrary: (account: string, data: Library) => void,
) {
  const handler = useRef(onLibrary);
  handler.current = onLibrary;
  const active = useRef(account);
  active.current = account;
  const [state, setState] = useState<BackupState>(() =>
    account ? backupService.state(account) : { ...defaultBackup },
  );
  const [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [profileRevision, setProfileRevision] = useState(0);
  const [localIssue, setLocalIssue] = useState<SyncIssue | null>(null);
  async function run(force = false) {
    if (!account || !cloudAvailable) return false;
    if (navigator.onLine === false) {
      if (force) setLocalIssue(explainSyncError(new Error("offline")));
      return false;
    }
    if (
      !force &&
      (!automaticDue(backupService.state(account), Date.now()) ||
        document.hidden)
    )
      return false;
    setBusy(true);
    setLocalIssue(null);
    try {
      const result = await backupService.synchronize(account, force);
      if (active.current === account) {
        setState(result.state);
        if (!result.skipped) handler.current(account, read(account));
      }
      return !result.skipped;
    } catch (error) {
      if (active.current === account) {
        setState(backupService.state(account));
        setLocalIssue(explainSyncError(error));
      }
      return false;
    } finally {
      if (active.current === account) setBusy(false);
    }
  }
  useEffect(() => {
    setState(account ? backupService.state(account) : { ...defaultBackup });
    setBusy(false);
    setLocalIssue(null);
    if (!account || !cloudAvailable) return;
    const key = backupKey(getConfig().url || "", account);
    const refresh = () => {
      if (active.current === account) setState(backupService.state(account));
    };
    const check = () => {
      setOnline(navigator.onLine);
      void run();
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === key) refresh();
    };
    const profileChanged = (event: Event) => {
      if ((event as CustomEvent).detail === account)
        setProfileRevision((n) => n + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === profileKey(getConfig().url || "", account))
        setProfileRevision((n) => n + 1);
      if (event.key === key) {
        refresh();
        check();
      }
    };
    // This timer only checks the local clock. It does not query Supabase every minute.
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    window.addEventListener("vela-backup-state", changed);
    window.addEventListener("storage", storage);
    window.addEventListener("vela-profile-state", profileChanged);
    check();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      window.removeEventListener("vela-backup-state", changed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("vela-profile-state", profileChanged);
    };
  }, [account]);
  function setFrequency(frequency: BackupFrequency) {
    if (!account) return;
    try {
      setState(backupService.setFrequency(account, frequency));
      setLocalIssue(null);
      void run();
    } catch (error) {
      setLocalIssue(explainSyncError(error));
    }
  }
  const pending = useMemo(
    () =>
      Boolean(
        account &&
        (state.revision > state.acknowledgedRevision ||
          profilePending(readCurrentProfile(account)) ||
          (!state.lastSuccess && Object.keys(read(account)).length)),
      ),
    [
      account,
      state.revision,
      state.acknowledgedRevision,
      state.lastSuccess,
      profileRevision,
    ],
  );
  const issue = localIssue || state.issue;
  const status = !account
    ? "local"
    : busy
      ? "syncing"
      : issue
        ? "error"
        : pending
          ? "pending"
          : state.lastSuccess
            ? "success"
            : "local";
  return {
    state,
    pending,
    online,
    status,
    issue,
    setFrequency,
    syncNow: () => run(true),
  };
}
export type BackupController = ReturnType<typeof useCloudBackup>;

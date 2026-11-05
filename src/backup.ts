import { syncUserProfile } from "./profile-sync";
import {
  cloud,
  getConfig,
  mergeCollections,
  read,
  sync,
  write,
  type Library,
  type SyncResult,
} from "./store";
import { explainSyncError, type SyncIssue } from "./sync-errors";
export const DAY = 24 * 60 * 60 * 1000;
export type BackupFrequency = "daily" | "weekly" | "manual";
export type BackupState = {
  frequency: BackupFrequency;
  lastSuccess: number;
  lastAttempt: number;
  retryAt: number;
  failures: number;
  revision: number;
  acknowledgedRevision: number;
  issue: SyncIssue | null;
};
export const defaultBackup: BackupState = {
  frequency: "daily",
  lastSuccess: 0,
  lastAttempt: 0,
  retryAt: 0,
  failures: 0,
  revision: 0,
  acknowledgedRevision: 0,
  issue: null,
};
export function nextAutomaticAt(state: BackupState): number | null {
  if (state.frequency === "manual") return null;
  return Math.max(
    state.lastSuccess
      ? state.lastSuccess + (state.frequency === "weekly" ? 7 * DAY : DAY)
      : 0,
    state.retryAt,
  );
}
export function automaticDue(state: BackupState, now: number) {
  const next = nextAutomaticAt(state);
  return next !== null && now >= next;
}
export function backupKey(project: string, account: string) {
  return `vela-backup-v1:${encodeURIComponent(project.replace(/\/$/, ""))}:${account}`;
}
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Runtime = {
  project: string;
  storage: StorageLike;
  now: () => number;
  read: (account: string) => Library;
  write: (account: string, data: Library) => void;
  sync: (account: string, data: Library) => Promise<SyncResult>;
  afterSync?: (account: string) => Promise<void>;
  emit?: (key: string) => void;
  lock?: <T>(key: string, job: () => Promise<T>) => Promise<T>;
};
export type BackupResult = {
  skipped: boolean;
  state: BackupState;
  data?: Library;
  uploaded?: number;
};
export function createBackupService(runtime: Runtime) {
  const flights = new Map<string, Promise<BackupResult>>();
  function state(account: string): BackupState {
    try {
      const raw = JSON.parse(
        runtime.storage.getItem(backupKey(runtime.project, account)) || "null",
      );
      if (!raw || typeof raw !== "object") return { ...defaultBackup };
      const valid: BackupState = { ...defaultBackup };
      if (["daily", "weekly", "manual"].includes(raw.frequency))
        valid.frequency = raw.frequency;
      for (const key of [
        "lastSuccess",
        "lastAttempt",
        "retryAt",
        "failures",
        "revision",
        "acknowledgedRevision",
      ] as const)
        if (Number.isSafeInteger(raw[key]) && raw[key] >= 0)
          valid[key] = raw[key];
      if (
        raw.issue &&
        ["schema", "permission", "network", "other"].includes(raw.issue.kind) &&
        typeof raw.issue.message === "string"
      )
        valid.issue = raw.issue;
      return valid;
    } catch {
      return { ...defaultBackup };
    }
  }
  function save(account: string, value: BackupState) {
    const key = backupKey(runtime.project, account);
    runtime.storage.setItem(key, JSON.stringify(value));
    runtime.emit?.(key);
    return value;
  }
  function changed(account: string) {
    const value = state(account);
    return save(account, { ...value, revision: value.revision + 1 });
  }
  function setFrequency(account: string, frequency: BackupFrequency) {
    if (!["daily", "weekly", "manual"].includes(frequency))
      throw new Error("Fréquence invalide.");
    return save(account, { ...state(account), frequency });
  }
  function synchronize(account: string, force = false): Promise<BackupResult> {
    const key = backupKey(runtime.project, account),
      existing = flights.get(key);
    if (existing)
      return existing.then((result) =>
        force && result.skipped ? synchronize(account, true) : result,
      );
    const job = async (): Promise<BackupResult> => {
      const initial = state(account);
      if (!force && !automaticDue(initial, runtime.now()))
        return { skipped: true, state: initial };
      // A crash during the attempt must not cause repeated requests at every restart.
      save(account, {
        ...initial,
        lastAttempt: runtime.now(),
        retryAt: runtime.now() + DAY / 24,
      });
      try {
        const result = await runtime.sync(account, runtime.read(account));
        // Preserve edits made while the request was in flight. They remain pending for the next backup.
        const merged = mergeCollections(runtime.read(account), result.library);
        runtime.write(account, merged);
        if (runtime.afterSync) await runtime.afterSync(account);
        const current = state(account);
        const done = save(account, {
          ...current,
          lastSuccess: runtime.now(),
          retryAt: 0,
          failures: 0,
          issue: null,
          acknowledgedRevision: initial.revision,
        });
        return {
          skipped: false,
          state: done,
          data: merged,
          uploaded: result.uploaded,
        };
      } catch (error) {
        const current = state(account),
          failures = Math.min(current.failures + 1, 30),
          issue = explainSyncError(error);
        const delay =
          issue.kind === "network"
            ? Math.min(DAY, (DAY / 24) * 2 ** Math.min(failures - 1, 5))
            : DAY;
        try {
          save(account, {
            ...current,
            failures,
            issue,
            retryAt: runtime.now() + delay,
          });
        } catch {
          /* Keep the original failure if storage is also full. */
        }
        throw error;
      }
    };
    // Install the in-flight promise before any storage event or native resume can start another attempt.
    const promise = Promise.resolve()
      .then(() => (runtime.lock ? runtime.lock(key, job) : job()))
      .finally(() => flights.delete(key));
    flights.set(key, promise);
    return promise;
  }
  return { state, changed, setFrequency, synchronize };
}
export const backupService = createBackupService({
  project: getConfig().url || "",
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  now: Date.now,
  read,
  write: (account, data) => write(data, account),
  sync,
  afterSync: syncUserProfile,
  emit: (key) => {
    if (typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("vela-backup-state", { detail: key }),
      );
  },
  lock: async <T>(key: string, job: () => Promise<T>): Promise<T> => {
    if (typeof navigator !== "undefined" && navigator.locks)
      return await navigator.locks.request(key, job);
    return await job();
  },
});
export const cloudAvailable = Boolean(cloud);

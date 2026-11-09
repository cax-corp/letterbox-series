import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud, getConfig } from "./store";
import { movieGenres } from "./recommendations";
import { tmdbRequest, type Title } from "./catalog";
import { readRemoteUser } from "./remote-user";
import { t as tr } from "./i18n";
export type ExcludedSaga = { id: number; name: string };
export type DiscoveryPreferences = {
  version: 1;
  genres: number[];
  sagas: ExcludedSaga[];
  protectSpoilers: boolean;
  updated: string;
};
export const defaultDiscovery: DiscoveryPreferences = {
  version: 1,
  genres: [],
  sagas: [],
  protectSpoilers: true,
  updated: "1970-01-01T00:00:00.000Z",
};
export const discoveryGenres = [
  { id: 28, name: "Action" },
  { id: 12, name: "Aventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comédie" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentaire" },
  { id: 18, name: "Drame" },
  { id: 10751, name: "Familial" },
  { id: 14, name: "Fantastique" },
  { id: 36, name: "Histoire" },
  { id: 27, name: "Horreur" },
  { id: 10402, name: "Musique" },
  { id: 9648, name: "Mystère" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science-fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Guerre" },
  { id: 37, name: "Western" },
];
export function validateDiscovery(v: unknown): DiscoveryPreferences | null {
  const p = v as DiscoveryPreferences;
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.genres) ||
    p.genres.length > 30 ||
    !p.genres.every((g) => discoveryGenres.some((x) => x.id === g)) ||
    !Array.isArray(p.sagas) ||
    p.sagas.length > 12 ||
    !p.sagas.every(
      (s) =>
        s &&
        Number.isSafeInteger(s.id) &&
        s.id > 0 &&
        typeof s.name === "string" &&
        s.name.length <= 100,
    ) ||
    typeof p.protectSpoilers !== "boolean" ||
    !Number.isFinite(Date.parse(p.updated))
  )
    return null;
  return {
    version: 1,
    genres: [...new Set(p.genres)].sort((a, b) => a - b),
    sagas: [
      ...new Map(
        p.sagas.map((s) => [s.id, { id: s.id, name: s.name.trim() }]),
      ).values(),
    ],
    protectSpoilers: p.protectSpoilers,
    updated: p.updated,
  };
}
const key = (account: string) =>
  `vela-discovery-v1:${getConfig().url || "local"}:${account}`;
export function readDiscovery(account = "local", remote?: unknown) {
  let local: DiscoveryPreferences | null = null;
  try {
    local = validateDiscovery(
      JSON.parse(localStorage.getItem(key(account)) || "null"),
    );
  } catch {}
  const other = validateDiscovery(remote);
  return other &&
    (!local || Date.parse(other.updated) > Date.parse(local.updated))
    ? other
    : local || { ...defaultDiscovery, genres: [], sagas: [] };
}
function persist(account: string, value: DiscoveryPreferences) {
  const encoded = JSON.stringify(value);
  if (localStorage.getItem(key(account)) === encoded) return;
  localStorage.setItem(key(account), encoded);
  window.dispatchEvent(
    new CustomEvent("vela-discovery-state", { detail: account }),
  );
}
const flights = new Map<string, Promise<void>>();
export async function syncDiscoveryPreferences(account: string) {
  if (!cloud || account === "local") return;
  const name = key(account),
    old = flights.get(name);
  if (old) return old;
  const job = (async () => {
    const { data, error } = await cloud.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (session?.user.id !== account) return;
    const result = await readRemoteUser(cloud, account, session.access_token);
    if (result.error) throw result.error;
    if (result.data.user?.id !== account) return;
    let remote = validateDiscovery(
      result.data.user.user_metadata?.vela_discovery,
    );
    for (let pass = 0; pass < 3; pass++) {
      const chosen = readDiscovery(account, remote);
      persist(account, chosen);
      if (
        chosen.updated === defaultDiscovery.updated ||
        (remote && Date.parse(remote.updated) >= Date.parse(chosen.updated))
      )
        break;
      const config = getConfig(),
        response = await fetch(config.url + "/auth/v1/user", {
          method: "PUT",
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: { vela_discovery: chosen } }),
        });
      const saved = await response.json();
      if (!response.ok || saved.id !== account)
        throw new Error(
          tr(
            "Vos préférences restent sur cet appareil. La synchronisation sera réessayée.",
          ),
        );
      remote = validateDiscovery(saved.user_metadata?.vela_discovery);
      if (!remote || remote.updated !== chosen.updated)
        throw new Error(tr("Les préférences n’ont pas pu être confirmées."));
    }
  })().finally(() => flights.delete(name));
  flights.set(name, job);
  return job;
}
export type SagaCache = { at: number; ids: number[] };
const sagaKey = (id: number) => `vela-saga-members-v1:${id}`;
export function readSaga(id: number): SagaCache | null {
  try {
    const v = JSON.parse(localStorage.getItem(sagaKey(id)) || "null");
    if (
      v &&
      Number.isFinite(v.at) &&
      Array.isArray(v.ids) &&
      v.ids.length <= 500 &&
      v.ids.every((x: unknown) => Number.isSafeInteger(x))
    )
      return v;
  } catch {}
  return null;
}
export async function resolveSaga(
  id: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const cached = readSaga(id);
  if (cached && Date.now() - cached.at < 86400000) return cached.ids;
  try {
    const data = await tmdbRequest(`/collection/${id}`, {}, signal);
    const ids = [
      ...new Set<number>(
        (data.parts || [])
          .filter((p: any) => Number.isSafeInteger(p.id) && p.id > 0)
          .map((p: any) => p.id),
      ),
    ].slice(0, 500);
    try {
      localStorage.setItem(
        sagaKey(id),
        JSON.stringify({ at: Date.now(), ids }),
      );
    } catch {}
    return ids;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (cached) return cached.ids;
    throw error;
  }
}
export function isExcluded(
  title: Title,
  prefs: DiscoveryPreferences,
  sagaIds: ReadonlySet<number> = new Set(),
) {
  if (movieGenres(title).some((id) => prefs.genres.includes(id))) return true;
  if (
    title.collectionId &&
    prefs.sagas.some((s) => s.id === title.collectionId)
  )
    return true;
  const id = /^tmdb-movie-(\d+)$/.exec(title.id);
  return Boolean(id && sagaIds.has(Number(id[1])));
}
export function useDiscoveryPreferences(user: User | null) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(saveTimer.current), [user?.id]);
  const account = user?.id || "local",
    owner = useRef(account);
  owner.current = account;
  const [, revision] = useState(0),
    [error, setError] = useState(""),
    [sagaState, setSagaState] = useState<{
      key: string;
      ids: Set<number>;
      ready: boolean;
    }>({ key: "", ids: new Set(), ready: true });
  const value = readDiscovery(account, user?.user_metadata?.vela_discovery),
    sagasKey = value.sagas
      .map((s) => s.id)
      .sort((a, b) => a - b)
      .join(",");
  useEffect(() => {
    const change = (e: Event) => {
      if ((e as CustomEvent).detail === account) revision((n) => n + 1);
    };
    window.addEventListener("vela-discovery-state", change);
    const storage = () => revision((n) => n + 1);
    window.addEventListener("storage", storage);
    const next = readDiscovery(account, user?.user_metadata?.vela_discovery);
    try {
      persist(account, next);
    } catch {
      setError(tr("Le stockage de cet appareil est plein."));
    }
    if (user)
      void syncDiscoveryPreferences(account).catch(() => {
        if (owner.current === account)
          setError(
            tr(
              "Vos préférences restent sur cet appareil. La synchronisation sera réessayée.",
            ),
          );
      });
    return () => {
      window.removeEventListener("vela-discovery-state", change);
      window.removeEventListener("storage", storage);
    };
  }, [account, user?.user_metadata?.vela_discovery?.updated]);
  useEffect(() => {
    const c = new AbortController();
    if (!value.sagas.length) {
      setSagaState({ key: sagasKey, ids: new Set(), ready: true });
      return;
    }
    setSagaState({
      key: sagasKey,
      ids: new Set(value.sagas.flatMap((s) => readSaga(s.id)?.ids || [])),
      ready: false,
    });
    (async () => {
      const ids: number[] = [];
      for (const saga of value.sagas)
        ids.push(...(await resolveSaga(saga.id, c.signal)));
      if (!c.signal.aborted) {
        setSagaState({ key: sagasKey, ids: new Set(ids), ready: true });
        setError("");
      }
    })().catch(() => {
      if (!c.signal.aborted)
        setError(
          tr(
            "Les exclusions de saga n’ont pas pu être chargées. Réessayez avec une connexion.",
          ),
        );
    });
    return () => c.abort();
  }, [sagasKey, account]);
  function change(
    patch: Partial<
      Pick<DiscoveryPreferences, "genres" | "sagas" | "protectSpoilers">
    >,
  ) {
    const next = validateDiscovery({
      ...value,
      ...patch,
      updated: new Date(
        Math.max(Date.now(), Date.parse(value.updated) + 1),
      ).toISOString(),
    });
    if (!next) return;
    try {
      persist(account, next);
    } catch {
      setError(tr("Le stockage de cet appareil est plein."));
      return;
    }
    setError("");
    clearTimeout(saveTimer.current);
    if (user)
      saveTimer.current = setTimeout(() => {
        void syncDiscoveryPreferences(account).catch((e) => {
          if (owner.current === account) setError(e.message);
        });
      }, 1500);
  }
  return {
    value,
    change,
    error,
    ready:
      !value.sagas.length || (sagaState.key === sagasKey && sagaState.ready),
    excluded: (title: Title) => isExcluded(title, value, sagaState.ids),
  };
}

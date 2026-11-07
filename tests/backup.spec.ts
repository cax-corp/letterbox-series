import { test, expect } from "./fixtures";
import { createClient } from "@supabase/supabase-js";
import {
  automaticDue,
  backupKey,
  createBackupService,
  DAY,
  defaultBackup,
  nextAutomaticAt,
} from "../src/backup";
import {
  empty,
  mergeCollections,
  sync,
  type Entry,
  type Library,
} from "../src/store";
function entry(id = 1, at = "2026-11-05T10:00:00Z"): Entry {
  return {
    ...empty({
      id: `movie-${id}`,
      kind: "movie",
      name: `Film ${id}`,
      year: "2024",
      image: "",
      summary: "Un synopsis",
      genres: ["Aventure"],
    }),
    updated: at,
    watchedAt: "2026-11-05",
  };
}
function setup() {
  let now = Date.parse("2026-11-05T12:00:00Z"),
    calls = 0;
  const values = new Map<string, string>(),
    libraries = new Map<string, Library>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  let remote: Library = {};
  let failure: Error | null = null;
  let pause: Promise<void> | null = null;
  const runtime = {
    project: "https://test.supabase.co",
    storage,
    now: () => now,
    read: (id: string) => libraries.get(id) || {},
    write: (id: string, data: Library) => {
      libraries.set(id, data);
    },
    sync: async (_id: string, local: Library) => {
      calls++;
      if (pause) await pause;
      if (failure) throw failure;
      remote = mergeCollections(local, remote);
      return { library: remote, uploaded: Object.keys(local).length };
    },
  };
  return {
    runtime,
    service: createBackupService(runtime),
    libraries,
    values,
    calls: () => calls,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    fail: (e: Error | null) => {
      failure = e;
    },
    pause: (p: Promise<void> | null) => {
      pause = p;
    },
  };
}
test("quotidienne par défaut, 24h complètes, redémarrage et changement de fréquence sans requête inutile", async () => {
  const x = setup();
  x.libraries.set("a", { "movie-1": entry() });
  await x.service.synchronize("a");
  expect(x.calls()).toBe(1);
  x.service.changed("a");
  await x.service.synchronize("a");
  expect(x.calls()).toBe(1);
  const restarted = createBackupService(x.runtime);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(1);
  x.advance(DAY - 1);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(1);
  x.advance(1);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(2);
  restarted.setFrequency("a", "weekly");
  x.advance(DAY);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(2);
  x.advance(6 * DAY);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(3);
  restarted.setFrequency("a", "manual");
  x.advance(20 * DAY);
  await restarted.synchronize("a");
  expect(x.calls()).toBe(3);
  await restarted.synchronize("a", true);
  expect(x.calls()).toBe(4);
});
test("échec : date de réussite conservée, reprise espacée persistée, action manuelle prioritaire", async () => {
  const x = setup();
  await x.service.synchronize("a");
  const success = x.service.state("a").lastSuccess;
  x.advance(DAY);
  x.service.changed("a");
  x.fail(new Error("Network fetch failed"));
  await expect(x.service.synchronize("a")).rejects.toThrow("Network");
  expect(x.service.state("a").lastSuccess).toBe(success);
  expect(x.service.state("a").acknowledgedRevision).toBe(0);
  expect(x.service.state("a").issue?.kind).toBe("network");
  expect(nextAutomaticAt(x.service.state("a"))).toBe(x.now() + DAY / 24);
  await createBackupService(x.runtime).synchronize("a");
  expect(x.calls()).toBe(2);
  x.fail(null);
  await x.service.synchronize("a", true);
  expect(x.calls()).toBe(3);
  expect(x.service.state("a").issue).toBe(null);
  expect(x.service.state("a").acknowledgedRevision).toBe(1);
});
test("modification pendant l’envoi conservée et laissée en attente ; deux déclencheurs ne doublent pas l’envoi", async () => {
  const x = setup(),
    first = entry();
  x.libraries.set("a", { [first.title.id]: first });
  x.service.changed("a");
  let release!: () => void;
  x.pause(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  const automatic = x.service.synchronize("a");
  const manual = x.service.synchronize("a", true);
  await expect.poll(x.calls).toBe(1);
  const later = { ...first, favorite: true, updated: "2026-11-05T12:00:01Z" };
  x.libraries.set("a", { [later.title.id]: later });
  x.service.changed("a");
  release();
  await Promise.all([automatic, manual]);
  expect(x.calls()).toBe(1);
  expect(x.libraries.get("a")?.[first.title.id].favorite).toBe(true);
  expect(x.service.state("a").revision).toBe(2);
  expect(x.service.state("a").acknowledgedRevision).toBe(1);
});
test("les réglages et copies sont isolés par compte et projet ; schéma manquant ne relance pas à chaque ouverture", async () => {
  const x = setup();
  x.service.setFrequency("a", "manual");
  expect(x.service.state("b").frequency).toBe("daily");
  const other = createBackupService({
    ...x.runtime,
    project: "https://other.supabase.co",
  });
  expect(other.state("a").frequency).toBe("daily");
  expect(backupKey("https://test.supabase.co/", "a")).toBe(
    backupKey("https://test.supabase.co", "a"),
  );
  x.fail(
    Object.assign(new Error("Could not find public.library in cache"), {
      code: "PGRST205",
    }),
  );
  await expect(x.service.synchronize("b")).rejects.toBeTruthy();
  x.advance(DAY / 2);
  await createBackupService(x.runtime).synchronize("b");
  expect(x.calls()).toBe(1);
  expect(x.service.state("b").issue?.kind).toBe("schema");
  expect(x.service.state("a").lastAttempt).toBe(0);
  expect(automaticDue({ ...defaultBackup, frequency: "manual" }, x.now())).toBe(
    false,
  );
});
function clientFor(
  fetcher: (url: URL, init?: RequestInit) => Promise<Response>,
) {
  return createClient("https://test.supabase.co", "sb_publishable_test", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => fetcher(new URL(String(input)), init),
    },
  });
}
test("vrai SDK Supabase : lecture paginée, seulement les différences en écriture, zéro écriture à état identique", async () => {
  const old = entry(1),
    same = entry(2),
    remoteOnly = entry(3, "2026-11-05T13:00:00Z");
  const changed = { ...old, favorite: true, updated: "2026-11-05T14:00:00Z" };
  let remote: Library = {
    [old.title.id]: old,
    [same.title.id]: same,
    [remoteOnly.title.id]: remoteOnly,
  };
  // JSONB may reorder object keys. Use a genuinely reordered, complete nested object.
  remote[same.title.id] = Object.fromEntries(
    Object.entries(same).reverse(),
  ) as Entry;
  const writes: any[][] = [];
  let reads = 0;
  const client = clientFor(async (url, init) => {
    if (init?.method === "POST") {
      const rows = JSON.parse(String(init.body));
      expect(rows.every((r: any) => r.user_id === "a")).toBe(true);
      writes.push(rows);
      for (const row of rows) remote[row.title_id] = row.entry;
      return new Response("[]", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    expect(url.searchParams.get("user_id")).toBe("eq.a");
    reads++;
    return new Response(
      JSON.stringify(Object.values(remote).map((entry) => ({ entry }))),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  const initial = { ...remote, [changed.title.id]: changed };
  const result = await sync("a", initial, client);
  expect(result.uploaded).toBe(1);
  expect(writes[0].map((r) => r.title_id)).toEqual(["movie-1"]);
  expect(result.library[remoteOnly.title.id]).toEqual(remoteOnly);
  await sync("a", result.library, client);
  expect(writes).toHaveLength(1);
  expect(reads).toBe(2);
});
test("la restauration lit plus de 1000 entrées sans tronquer la sauvegarde et n’envoie pas les données plus anciennes", async () => {
  const remote = Array.from({ length: 1001 }, (_, i) => entry(i + 1));
  const offsets: number[] = [];
  let posts = 0;
  const client = clientFor(async (url, init) => {
    if (init?.method === "POST") {
      posts++;
      return new Response("[]", { status: 201 });
    }
    const offset = Number(url.searchParams.get("offset") || 0);
    offsets.push(offset);
    return new Response(
      JSON.stringify(
        remote.slice(offset, offset + 1000).map((entry) => ({ entry })),
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  const result = await sync(
    "a",
    { "movie-1": entry(1, "2020-01-01T00:00:00Z") },
    client,
  );
  expect(Object.keys(result.library)).toHaveLength(1001);
  expect(offsets).toEqual([0, 1000]);
  expect(posts).toBe(0);
});
test("un échec d’écriture ne valide pas une sauvegarde partielle ; une entrée distante invalide ne touche pas le local", async () => {
  const x = setup();
  x.libraries.set("a", { "movie-1": entry() });
  x.service.changed("a");
  const client = clientFor(async (_url, init) =>
    init?.method === "POST"
      ? new Response(JSON.stringify({ message: "network interrupted" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      : new Response("[]", { headers: { "Content-Type": "application/json" } }),
  );
  const failed = createBackupService({
    ...x.runtime,
    sync: (account, data) => sync(account, data, client),
  });
  await expect(failed.synchronize("a")).rejects.toBeTruthy();
  expect(failed.state("a").lastSuccess).toBe(0);
  expect(failed.state("a").revision).toBe(1);
  expect(Object.keys(x.libraries.get("a")!)).toHaveLength(1);
  const invalid = clientFor(
    async () =>
      new Response(JSON.stringify([{ entry: { title: { id: "movie-1" } } }]), {
        headers: { "Content-Type": "application/json" },
      }),
  );
  await expect(sync("a", x.libraries.get("a")!, invalid)).rejects.toThrow(
    "Collection invalide",
  );
});

test("deux onglets partageant le verrou recontrôlent l’échéance et ne font qu’une sauvegarde", async () => {
  const x = setup();
  let queue = Promise.resolve();
  const lock = async <T>(_key: string, job: () => Promise<T>): Promise<T> => {
    const wait = queue;
    let release!: () => void;
    queue = new Promise<void>((r) => {
      release = r;
    });
    await wait;
    try {
      return await job();
    } finally {
      release();
    }
  };
  const first = createBackupService({ ...x.runtime, lock }),
    second = createBackupService({ ...x.runtime, lock });
  await Promise.all([first.synchronize("a"), second.synchronize("a")]);
  expect(x.calls()).toBe(1);
  expect(first.state("a").lastSuccess).toBe(second.state("a").lastSuccess);
});
test("écriture par lots : échec partiel sans validation, reprise limitée aux éléments encore absents", async () => {
  const x = setup(),
    local = Object.fromEntries(
      Array.from({ length: 251 }, (_, i) => {
        const e = entry(i + 1);
        return [e.title.id, e];
      }),
    );
  x.libraries.set("a", local);
  x.service.changed("a");
  const remote: Library = {};
  const batches: string[][] = [];
  let failing = true;
  const client = clientFor(async (_url, init) => {
    if (init?.method === "POST") {
      const rows = JSON.parse(String(init.body));
      batches.push(rows.map((r: any) => r.title_id));
      if (failing && batches.length === 2)
        return new Response(
          JSON.stringify({ message: "network unavailable" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      for (const row of rows) remote[row.title_id] = row.entry;
      return new Response("[]", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify(Object.values(remote).map((entry) => ({ entry }))),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  const service = createBackupService({
    ...x.runtime,
    sync: (account, data) => sync(account, data, client),
  });
  await expect(service.synchronize("a")).rejects.toBeTruthy();
  expect(service.state("a").lastSuccess).toBe(0);
  expect(batches).toHaveLength(2);
  expect(Object.keys(remote)).toHaveLength(100);
  failing = false;
  const result = await service.synchronize("a", true);
  expect(result.uploaded).toBe(151);
  expect(batches.map((b) => b.length)).toEqual([100, 100, 100, 51]);
  expect(batches[2]).not.toContain("movie-1");
  expect(Object.keys(remote)).toHaveLength(251);
  expect(service.state("a").acknowledgedRevision).toBe(1);
});

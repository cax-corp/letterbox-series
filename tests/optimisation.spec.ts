import { test, expect } from "./fixtures";
import { RequestCache } from "../src/request-cache";
import { readRemoteUser } from "../src/remote-user";
import { empty, sync, type Library } from "../src/store";
import { entryFingerprint, canonicalJson } from "../src/library-manifest";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("cache catalogue : même requête partagée, annulations indépendantes, objets isolés et expiration", async () => {
  let now = 0,
    calls = 0,
    release!: (value: any) => void;
  const cache = new RequestCache(2, 1000, () => now),
    a = new AbortController(),
    b = new AbortController();
  const load = () => {
    calls++;
    return new Promise<any>((resolve) => (release = resolve));
  };
  const first = cache.get("catalog", load, 100, a.signal),
    second = cache.get("catalog", load, 100, b.signal);
  await expect.poll(() => calls).toBe(1);
  a.abort();
  await expect(first).rejects.toMatchObject({ name: "AbortError" });
  release({ results: [1, 2] });
  expect(await second).toEqual({ results: [1, 2] });
  const hit = await cache.get<any>("catalog", load, 100);
  hit.results.push(3);
  expect(await cache.get("catalog", load, 100)).toEqual({ results: [1, 2] });
  expect(calls).toBe(1);
  now = 101;
  expect(
    await cache.get(
      "catalog",
      async () => {
        calls++;
        return { results: [4] };
      },
      100,
    ),
  ).toEqual({ results: [4] });
  expect(calls).toBe(2);
});
test("cache : plus aucun lecteur annule le réseau, une panne n’est jamais mémorisée, limite mémoire", async () => {
  const cache = new RequestCache(2, 1000),
    controller = new AbortController();
  let cancelled = false;
  const pending = cache.get(
    "a",
    (signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          cancelled = true;
          reject(new DOMException("cancel", "AbortError"));
        });
      }),
    100,
    controller.signal,
  );
  await new Promise((r) => setTimeout(r, 0));
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(cancelled).toBe(true);
  await expect(
    cache.get(
      "b",
      async () => {
        throw new Error("network");
      },
      100,
    ),
  ).rejects.toThrow("network");
  expect(await cache.get("b", async () => 42, 100)).toBe(42);
  await cache.get("c", async () => 1, 100);
  await cache.get("d", async () => 2, 100);
  let reloaded = 0;
  await cache.get(
    "b",
    async () => {
      reloaded++;
      return 42;
    },
    100,
  );
  expect(reloaded).toBe(1);
});
test("compte : lectures simultanées regroupées, aucun cache entre comptes ou tentatives", async () => {
  let calls = 0;
  const client = {
    auth: {
      getUser: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return { data: { user: { id: "a" } }, error: null };
      },
    },
  } as any;
  await Promise.all([
    readRemoteUser(client, "a", "token-a"),
    readRemoteUser(client, "a", "token-a"),
    readRemoteUser(client, "b", "token-b"),
  ]);
  expect(calls).toBe(2);
  await readRemoteUser(client, "a", "token-a");
  expect(calls).toBe(3);
});
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const entry = (id: number) => ({
  ...empty({
    id: `movie-${id}`,
    kind: "movie" as const,
    name: `Film ${id}`,
    year: "2024",
    image: "",
    genres: ["Drame"],
    summary: 'Étoiles 🌙, guillemets " et accents.',
  }),
  updated: "2026-11-08T12:00:00Z",
});
test("SQL : empreintes identiques au client, pagination et isolation du compte, spoilers publics", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
    );
    await db.exec(
      readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/public-sharing.sql", import.meta.url),
        "utf8",
      ),
    );
    const migration = readFileSync(
      new URL("../supabase/vela-2.10.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const e = entry(1);
    await db.query(
      "insert into public.library(user_id,title_id,entry) values($1,$2,$3::jsonb)",
      [a, e.title.id, JSON.stringify(e)],
    );
    await db.query(
      "insert into public.library(user_id,title_id,entry) values($1,$2,$3::jsonb)",
      [b, e.title.id, JSON.stringify({ ...e, review: "secret B" })],
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const rows = await db.query<any>(
      "select * from public.vela_library_fingerprints()",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].fingerprint).toBe(await entryFingerprint(e));
    await db.exec("set role anon");
    await expect(
      db.exec("select * from public.vela_library_fingerprints()"),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.close();
  }
});
test("sauvegarde : titres identiques non téléchargés, seulement les différences et aucune écriture superflue", async () => {
  const remote: Library = {
    "movie-1": entry(1),
    "movie-2": entry(2),
    "movie-3": entry(3),
  };
  const hashes = await Promise.all(
    Object.values(remote).map(async (e) => ({
      title_id: e.title.id,
      updated: e.updated,
      fingerprint: await entryFingerprint(e),
    })),
  );
  const fullBytes = Buffer.byteLength(
    JSON.stringify(Object.values(remote).map((entry) => ({ entry }))),
  );
  const manifestBytes = Buffer.byteLength(JSON.stringify(hashes));
  expect(manifestBytes).toBeLessThan(fullBytes);
  console.log(
    "Library JSON bytes",
    JSON.stringify({ full: fullBytes, manifest: manifestBytes }),
  );
  const reads: string[][] = [],
    writes: any[][] = [];
  const client = createClient(
    "https://manifest-test.supabase.co",
    "fake-publishable",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, options) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith("/vela_library_fingerprints"))
            return new Response(JSON.stringify(hashes), {
              headers: { "Content-Type": "application/json" },
            });
          if (options?.method === "POST") {
            writes.push(JSON.parse(String(options.body)));
            return new Response("[]", {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          }
          const ids = (url.searchParams.get("title_id") || "")
            .slice(4, -1)
            .split(",");
          reads.push(ids);
          return new Response(
            JSON.stringify(
              ids
                .filter((id) => remote[id])
                .map((id) => ({ entry: remote[id] })),
            ),
            { headers: { "Content-Type": "application/json" } },
          );
        },
      },
    },
  );
  const local = {
    ...remote,
    "movie-1": {
      ...remote["movie-1"],
      favorite: true,
      updated: "2026-11-08T13:00:00Z",
    },
  };
  delete (local as any)["movie-3"];
  const result = await sync(a, local, client);
  expect(reads.flat().sort()).toEqual(["movie-1", "movie-3"]);
  expect(result.library["movie-3"]).toEqual(remote["movie-3"]);
  expect(writes.flat().map((row) => row.title_id)).toEqual(["movie-1"]);
  reads.length = 0;
  writes.length = 0;
  await sync(a, remote, client);
  expect(reads).toHaveLength(0);
  expect(writes).toHaveLength(0);
});

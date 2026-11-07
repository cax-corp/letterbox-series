import { test, expect } from "./fixtures";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("état privé : migration réexécutable, conflits par réglage, aucune lecture anonyme ou croisée", async () => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222",
    at = new Date(Date.now() - 60000).toISOString(),
    old = new Date(Date.now() - 120000).toISOString();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');`,
    );
    const sql = readFileSync(
      new URL("../supabase/account-state.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const call = (items: any[]) =>
      db.query<{ key: string; payload: any }>(
        "select key,payload from public.vela_merge_private_state($1::jsonb)",
        [JSON.stringify(items)],
      );
    await call([
      { key: "palette", payload: { value: "iris" }, updated_at: at },
      {
        key: "notifications",
        payload: {
          value: { enabled: true, hour: 19, minute: 30, days: [1, 3, 5] },
        },
        updated_at: at,
      },
    ]);
    const signal = {
      title: {
        id: "tmdb-movie-42",
        kind: "movie",
        name: "Une mission",
        year: "2024",
        image: "",
        summary: "Des astronautes explorent une planète.",
        genres: ["Science-fiction"],
        genreIds: [878],
        source: "tmdb",
      },
      at: Date.parse(at),
      dwell: 800,
    };
    await call([
      { key: "skip:tmdb-movie-42", payload: signal, updated_at: at },
    ]);
    const storedSignal = await db.query<{ payload: unknown }>(
      "select payload from public.vela_private_state where key='skip:tmdb-movie-42'",
    );
    expect(storedSignal.rows[0].payload).toEqual(signal);
    const stale = await call([
      { key: "palette", payload: { value: "blue" }, updated_at: old },
      { key: "backupFrequency", payload: { value: "weekly" }, updated_at: at },
    ]);
    expect(stale.rows.find((r) => r.key === "palette")?.payload.value).toBe(
      "iris",
    );
    expect(
      stale.rows.find((r) => r.key === "backupFrequency")?.payload.value,
    ).toBe("weekly");
    for (const item of [
      {
        key: "notifications",
        payload: { value: { enabled: true, hour: 25, minute: 0, days: [1] } },
      },
      { key: "notifications", payload: { value: {} } },
      {
        key: "notifications",
        payload: { value: { enabled: true, hour: 19, minute: 0, days: [] } },
      },
      { key: "palette", payload: { value: "javascript:bad" } },
      { key: "skip:movie-1", payload: { title: { id: "movie-2" } } },
    ])
      await expect(call([{ ...item, updated_at: at }])).rejects.toThrow();
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select * from public.vela_private_state"),
    ).rejects.toThrow();
    await expect(call([])).rejects.toThrow();
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${b}',false)`,
    );
    expect(
      (await db.query("select * from public.vela_private_state")).rows,
    ).toHaveLength(0);
    await call([
      { key: "palette", payload: { value: "coral" }, updated_at: at },
    ]);
    expect(
      (
        await db.query(
          "select * from public.vela_private_state where user_id=$1",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.vela_private_state values($1,'theme','{\"value\":\"light\"}',$2)",
        [a, at],
      ),
    ).rejects.toThrow();
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`);
    expect(
      (
        await db.query<{ payload: any }>(
          "select payload from public.vela_private_state where key='palette'",
        )
      ).rows[0].payload.value,
    ).toBe("iris");
  } finally {
    await db.close();
  }
});

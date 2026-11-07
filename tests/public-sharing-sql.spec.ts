import { test, expect } from "./fixtures";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { profileDraft, reviewDraft } from "../src/public-sharing";
import {
  defaultProfile,
  avatarOptions,
  avatarBackgrounds,
} from "../src/profile";
import { empty } from "../src/store";
test("PostgreSQL : publication explicite, lecture anonyme limitée, isolation des auteurs et révocation", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');create table public.library(secret text);insert into public.library values('private-library');`,
    );
    const sql = readFileSync(
      new URL("../supabase/public-sharing.sql", import.meta.url),
      "utf8",
    );
    const legacy = sql
      .replace(
        /coalesce\(profile->>'avatar',''\) not in \([^\n]+\)/,
        "coalesce(profile->>'avatar','') not in ('initial','astronaut','cat','robot','ghost')",
      )
      .replace(
        /coalesce\(profile->>'background',''\) not in \([^\n]+\)/,
        "coalesce(profile->>'background','') not in ('ocean','violet','amber','coral','mint','slate','rose','midnight')",
      );
    await db.exec(legacy);
    const upgrade = readFileSync(
      new URL("../supabase/avatar-presets.sql", import.meta.url),
      "utf8",
    );
    await db.exec(upgrade);
    await db.exec(upgrade);
    const presets = avatarOptions.flatMap((avatar) =>
      avatarBackgrounds.map(
        (background) =>
          profileDraft(
            {
              ...defaultProfile,
              displayName: "Nora",
              avatar: avatar.id,
              background: background.id,
            },
            {},
          ).payload,
      ),
    );
    const allowed = await db.query<{ accepted: boolean }>(
      "select bool_and(public.vela_shared_payload_valid('profile',value)) as accepted from jsonb_array_elements($1::jsonb)",
      [JSON.stringify(presets)],
    );
    expect(allowed.rows[0].accepted).toBe(true);
    await db.exec(sql);
    const payload = profileDraft(
      {
        ...defaultProfile,
        displayName: "Nora",
        avatar: "cool",
        background: "theme",
      },
      {},
    ).payload!;
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const insert = await db.query<{ id: string }>(
      "insert into public.vela_shares(kind,target,payload)values($1,$2,$3) returning id",
      ["profile", "profile", JSON.stringify(payload)],
    );
    const id = insert.rows[0].id;
    const invalid = {
      ...payload,
      profile: { ...payload.profile, email: "private@example.com" },
    };
    await expect(
      db.query("update public.vela_shares set payload=$1 where id=$2", [
        JSON.stringify(invalid),
        id,
      ]),
    ).rejects.toThrow();
    await db.exec(`reset role;set role anon`);
    const publicRows = await db.query<{ payload: unknown }>(
      "select id,kind,payload,updated_at from public.vela_shares where id=$1",
      [id],
    );
    expect(publicRows.rows[0].payload).toEqual(payload);
    await expect(
      db.query("select owner_id from public.vela_shares"),
    ).rejects.toThrow();
    await expect(db.query("select * from public.library")).rejects.toThrow();
    await expect(
      db.query("delete from public.vela_shares where id=$1", [id]),
    ).rejects.toThrow();
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${b}',false)`,
    );
    expect(
      (
        await db.query(
          "delete from public.vela_shares where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.vela_shares set payload=$1 where id=$2 returning id",
          [JSON.stringify(payload), id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.vela_shares(owner_id,kind,target,payload)values($1,$2,$3,$4)",
        [a, "profile", "profile", JSON.stringify(payload)],
      ),
    ).rejects.toThrow();
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`,
    );
    const entry = {
      ...empty({
        id: "tmdb-movie-1",
        kind: "movie",
        name: "Film public",
        year: "2024",
        image: "",
        summary: "",
        genres: [],
      }),
      review: "Mon avis publié",
      rating: 4,
    };
    const review = reviewDraft(
      { ...defaultProfile, displayName: "Nora" },
      entry,
    ).payload!;
    await db.query(
      "insert into public.vela_shares(kind,target,payload)values($1,$2,$3)",
      ["review", entry.title.id, JSON.stringify(review)],
    );
    await expect(
      db.query(
        "insert into public.vela_shares(kind,target,payload)values($1,$2,$3)",
        ["review", "tmdb-movie-999", JSON.stringify(review)],
      ),
    ).rejects.toThrow();
    await db.query("delete from public.vela_shares where id=$1", [id]);
    await db.exec("reset role;set role anon");
    expect(
      (await db.query("select id from public.vela_shares where id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
});

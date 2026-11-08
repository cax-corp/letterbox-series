import { test, expect } from "./fixtures";
import {
  defaultProfile,
  makeProfile,
  validateProfile,
  type Profile,
} from "../src/profile";
import {
  maxPhotoDataLength,
  localProfilePhoto,
  remoteProfilePhoto,
} from "../src/profile-photo";
import {
  writeProfileRecord,
  readCurrentProfile,
  syncUserProfile,
} from "../src/profile-sync";
import { profileDraft } from "../src/public-sharing";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const local = "data:image/jpeg;base64,/9j/2Q==",
  url = `https://project.supabase.co/storage/v1/object/public/vela-avatars/${a}/${b}.jpg`;
const photoProfile = () =>
  makeProfile(
    { ...defaultProfile, displayName: "Nora", photo: local },
    defaultProfile,
  );

test("photos : seuls les JPEG bornés et URL du bucket sont acceptés, aucun fichier local dans le partage public", () => {
  const profile = photoProfile();
  expect(validateProfile(profile)?.photo).toBe(local);
  expect(validateProfile({ ...profile, photo: url })?.photo).toBe(url);
  for (const photo of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "https://example.com/photo.jpg",
    url + "?secret=token",
    local + "a".repeat(maxPhotoDataLength),
  ])
    expect(validateProfile({ ...profile, photo })).toBeNull();
  expect(profileDraft(profile, {}).payload?.profile.photo).toBeUndefined();
  expect(
    profileDraft({ ...profile, photo: url }, {}).payload?.profile.photo,
  ).toBe(url);
  expect(localProfilePhoto(local)).toBe(true);
  expect(remoteProfilePhoto(url)).toBe(true);
});

function backend() {
  let remote: Profile | null = null,
    fail = false,
    owner = a,
    hold: Promise<void> | null = null;
  const uploads: { path: string; body: Blob; options: any }[] = [],
    writes: Profile[] = [];
  const map = new Map<string, string>();
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => map.set(key, value),
    },
  });
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: owner } } },
        error: null,
      }),
      getUser: async () => ({
        data: { user: { id: owner, user_metadata: { vela_profile: remote } } },
        error: null,
      }),
      updateUser: async ({ data }: { data: { vela_profile: Profile } }) => {
        writes.push(data.vela_profile);
        remote = data.vela_profile;
        return {
          data: {
            user: { id: owner, user_metadata: { vela_profile: remote } },
          },
          error: null,
        };
      },
    },
    storage: {
      from: () => ({
        upload: async (path: string, body: Blob, options: any) => {
          uploads.push({ path, body, options });
          if (hold) await hold;
          return { error: fail ? { message: "Bucket not found" } : null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://project.supabase.co/storage/v1/object/public/vela-avatars/${path}`,
          },
        }),
      }),
    },
  };
  return {
    client: client as any,
    uploads,
    writes,
    remote: () => remote,
    fail: (value: boolean) => (fail = value),
    owner: (value: string) => (owner = value),
    hold: (value: Promise<void>) => (hold = value),
    restore: () => {
      if (old) Object.defineProperty(globalThis, "localStorage", old);
      else delete (globalThis as any).localStorage;
    },
  };
}
test("transfert : un JPEG dans Storage, uniquement une URL dans Auth, pas de réenvoi à l’identique", async () => {
  const mock = backend();
  try {
    writeProfileRecord(a, { profile: photoProfile(), synced: "" });
    await syncUserProfile(a, mock.client);
    expect(mock.uploads).toHaveLength(1);
    expect(mock.uploads[0].body.type).toBe("image/jpeg");
    expect(mock.uploads[0].options.upsert).toBe(false);
    expect(mock.writes).toHaveLength(1);
    expect(remoteProfilePhoto(mock.writes[0].photo!)).toBe(true);
    expect(JSON.stringify(mock.writes)).not.toContain("base64");
    expect(readCurrentProfile(a).profile.photo).toBe(mock.writes[0].photo);
    await syncUserProfile(a, mock.client);
    expect(mock.uploads).toHaveLength(1);
  } finally {
    mock.restore();
  }
});
test("échec Storage : photo locale conservée, aucune image dans Auth, reprise au prochain envoi", async () => {
  const mock = backend();
  try {
    writeProfileRecord(a, { profile: photoProfile(), synced: "" });
    mock.fail(true);
    await expect(syncUserProfile(a, mock.client)).rejects.toThrow("photo");
    expect(mock.writes).toHaveLength(0);
    expect(readCurrentProfile(a).profile.photo).toBe(local);
    mock.fail(false);
    await syncUserProfile(a, mock.client);
    expect(mock.writes).toHaveLength(1);
    expect(mock.uploads[0].path).toBe(mock.uploads[1].path);
  } finally {
    mock.restore();
  }
});
test("édition pendant le transfert : nom conservé et aucune réimportation de l’image", async () => {
  const mock = backend();
  try {
    const original = photoProfile();
    writeProfileRecord(a, { profile: original, synced: "" });
    let release!: () => void;
    mock.hold(new Promise<void>((r) => (release = r)));
    const job = syncUserProfile(a, mock.client);
    await expect.poll(() => mock.uploads.length).toBe(1);
    const newer = makeProfile(
      { ...original, displayName: "Nouveau nom" },
      original,
    );
    writeProfileRecord(a, { profile: newer, synced: "" });
    release();
    await job;
    expect(readCurrentProfile(a).profile.displayName).toBe("Nouveau nom");
    expect(remoteProfilePhoto(readCurrentProfile(a).profile.photo!)).toBe(true);
    await syncUserProfile(a, mock.client);
    expect(mock.uploads).toHaveLength(1);
    expect(mock.writes.at(-1)?.displayName).toBe("Nouveau nom");
  } finally {
    mock.restore();
  }
});
test("changement de compte pendant un transfert : aucune écriture des métadonnées du second compte", async () => {
  const mock = backend();
  try {
    writeProfileRecord(a, { profile: photoProfile(), synced: "" });
    let release!: () => void;
    mock.hold(new Promise<void>((r) => (release = r)));
    const job = syncUserProfile(a, mock.client);
    await expect.poll(() => mock.uploads.length).toBe(1);
    mock.owner(b);
    release();
    await job;
    expect(mock.writes).toHaveLength(0);
    expect(readCurrentProfile(a).profile.photo).toBe(local);
  } finally {
    mock.restore();
  }
});
test("PostgreSQL : bucket borné, dossiers isolés, pas de liste anonyme, photos distantes autorisées dans les liens", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`,
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/public-sharing.sql", import.meta.url),
        "utf8",
      ),
    );
    const sql = readFileSync(
      new URL("../supabase/profile-photos.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    expect(
      (
        await db.query<any>(
          "select public,file_size_limit,allowed_mime_types from storage.buckets where id='vela-avatars'",
        )
      ).rows[0],
    ).toEqual({
      public: true,
      file_size_limit: 65536,
      allowed_mime_types: ["image/jpeg"],
    });
    const payload = profileDraft({ ...photoProfile(), photo: url }, {}).payload;
    expect(
      (
        await db.query<any>(
          "select public.vela_shared_payload_valid('profile',$1::jsonb) as valid",
          [JSON.stringify(payload)],
        )
      ).rows[0].valid,
    ).toBe(true);
    expect(
      (
        await db.query<any>(
          "select public.vela_shared_payload_valid('profile',$1::jsonb) as valid",
          [
            JSON.stringify({
              ...payload,
              profile: { ...payload!.profile, photo: local },
            }),
          ],
        )
      ).rows[0].valid,
    ).toBe(false);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);insert into storage.objects(bucket_id,name) values('vela-avatars','${a}/${b}.jpg');`,
    );
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('vela-avatars','${b}/${b}.jpg')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('vela-avatars','${a}/photo.svg')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await db.exec("set role anon");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('vela-avatars','${b}/${b}.jpg')`,
      ),
    ).rejects.toThrow(/row-level security/);
  } finally {
    await db.close();
  }
});

import { test, expect } from "@playwright/test";
import {
  defaultProfile,
  avatarOptions,
  avatarBackgrounds,
  makeProfile,
  validateProfile,
  profileKey,
  profilePending,
  type Profile,
} from "../src/profile";
import {
  hydrateProfile,
  readCurrentProfile,
  syncUserProfile,
  writeProfileRecord,
} from "../src/profile-sync";
import { profileStats } from "../src/profile-stats";
import {
  profileShare,
  reviewShare,
  publicTitleUrl,
  sharedPageUrl,
} from "../src/sharing";
import { empty, type Library } from "../src/store";
import { createBackupService } from "../src/backup";
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
  map = new Map<string, string>();
const storage = {
  getItem: (k: string) => map.get(k) || null,
  setItem: (k: string, v: string) => {
    map.set(k, v);
  },
};
test.beforeEach(() => {
  map.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
});
test.afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  else delete (globalThis as any).localStorage;
});
const title = (id = 1) => ({
  id: `movie-${id}`,
  name: `Film ${id}`,
  kind: "movie" as const,
  year: "2024",
  image: "https://example.com/poster.png",
  summary: "Résumé public",
  genres: ["Aventure"],
});
const custom = (name = "Lyra", time = Date.parse("2026-11-05T12:00:00Z")) =>
  makeProfile(
    {
      ...defaultProfile,
      displayName: name,
      bio: "Le cinéma, chaque semaine.",
      avatar: "cat",
      background: "violet",
      featured: [title()],
    },
    defaultProfile,
    time,
  );
function client(remote: Profile | null = null) {
  let profile = remote,
    puts = 0,
    fail = false,
    hold: Promise<void> | null = null;
  const auth = {
    getSession: async () => ({
      data: { session: { user: { id: "a" } } },
      error: null,
    }),
    getUser: async () => ({
      data: {
        user: {
          id: "a",
          user_metadata: profile ? { vela_profile: profile } : {},
        },
      },
      error: null,
    }),
    updateUser: async ({ data }: { data: { vela_profile: Profile } }) => {
      puts++;
      if (hold) await hold;
      if (fail)
        return { error: new Error("Network failed"), data: { user: null } };
      profile = data.vela_profile;
      return {
        error: null,
        data: { user: { id: "a", user_metadata: { vela_profile: profile } } },
      };
    },
  };
  return {
    api: { auth } as any,
    puts: () => puts,
    remote: () => profile,
    fail: () => {
      fail = true;
    },
    hold: (p: Promise<void>) => {
      hold = p;
    },
  };
}
test("profil strict : identifiants d’avatars et fonds, quatre titres au maximum, aucun import d’image", () => {
  const p = custom();
  expect(validateProfile(p)).toEqual(p);
  for (const avatar of avatarOptions)
    for (const background of avatarBackgrounds)
      expect(
        validateProfile({ ...p, avatar: avatar.id, background: background.id }),
      ).not.toBeNull();
  expect(validateProfile({ ...p, avatar: "https://my-photo.jpg" })).toBe(null);
  expect(
    validateProfile({ ...p, background: "url(javascript:alert(1))" }),
  ).toBe(null);
  expect(validateProfile({ ...p, displayName: "x".repeat(41) })).toBe(null);
  expect(validateProfile({ ...p, featured: [title(), title()] })).toBe(null);
  expect(validateProfile({ ...p, featured: [1, 2, 3, 4, 5].map(title) })).toBe(
    null,
  );
  expect(
    validateProfile({ ...p, featured: [{ ...title(), kind: "series" }] }),
  ).toBe(null);
  expect(
    validateProfile({
      ...p,
      featured: [{ ...title(), image: "data:image/png;base64,secret" }],
    }),
  )?.toMatchObject({ featured: [{ image: "" }] });
  expect(() => makeProfile({ ...p, displayName: "   " }, p)).toThrow("nom");
  expect(p.featured[0].summary).toBe("");
});
test("profil isolé par compte/projet et horodatage strictement croissant", () => {
  const p = custom();
  writeProfileRecord("a", { profile: p, synced: "" });
  expect(readCurrentProfile("a").profile.displayName).toBe("Lyra");
  expect(readCurrentProfile("b").profile.displayName).toBe("");
  expect(profileKey("https://a.supabase.co", "a")).not.toBe(
    profileKey("https://b.supabase.co", "a"),
  );
  expect(
    Date.parse(
      makeProfile({ ...p, displayName: "Autre" }, p, Date.parse(p.updated))
        .updated,
    ),
  ).toBe(Date.parse(p.updated) + 1);
  hydrateProfile("a", defaultProfile);
  expect(readCurrentProfile("a").profile).toEqual(p);
});
test("synchronisation du profil dans les métadonnées du compte : une écriture légère puis aucune réécriture", async () => {
  const p = custom(),
    c = client();
  writeProfileRecord("a", { profile: p, synced: "" });
  await syncUserProfile("a", c.api);
  expect(c.puts()).toBe(1);
  expect(c.remote()).toEqual(p);
  expect(profilePending(readCurrentProfile("a"))).toBe(false);
  await syncUserProfile("a", c.api);
  expect(c.puts()).toBe(1);
  expect(JSON.stringify(c.remote()).length).toBeLessThan(3000);
  expect(JSON.stringify(c.remote())).not.toContain("base64");
});
test("restauration d’un profil plus récent et conservation d’un changement fait pendant l’envoi", async () => {
  const remote = custom("Distant"),
    c = client(remote);
  await syncUserProfile("a", c.api);
  expect(readCurrentProfile("a").profile.displayName).toBe("Distant");
  expect(c.puts()).toBe(0);
  const local = custom("Local", Date.parse(remote.updated) + 100);
  writeProfileRecord("a", { profile: local, synced: remote.updated });
  let release!: () => void;
  c.hold(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  const pending = syncUserProfile("a", c.api);
  await expect.poll(c.puts).toBe(1);
  const later = custom("Après", Date.parse(local.updated) + 100);
  writeProfileRecord("a", { profile: later, synced: remote.updated });
  release();
  await pending;
  expect(readCurrentProfile("a").profile.displayName).toBe("Après");
  expect(profilePending(readCurrentProfile("a"))).toBe(true);
});
test("échec ou compte différent : aucun acquittement mensonger ni écriture sur le mauvais compte", async () => {
  const c = client();
  c.fail();
  writeProfileRecord("a", { profile: custom(), synced: "" });
  await expect(syncUserProfile("a", c.api)).rejects.toThrow("Network");
  expect(profilePending(readCurrentProfile("a"))).toBe(true);
  const other = client();
  await syncUserProfile("b", other.api);
  expect(other.puts()).toBe(0);
  expect(readCurrentProfile("b").profile.displayName).toBe("");
});
test("statistiques : dates de visionnage, séries sans double compte d’épisodes, moyenne et mois vides", () => {
  const entries: Library = {
    a: {
      ...empty(title(1)),
      watched: true,
      rating: 4,
      review: "Super",
      watchedAt: "2026-11-04",
      updated: "2026-11-05T20:00:00Z",
    },
    b: {
      ...empty({ ...title(2), id: "series-2", kind: "series" }),
      watched: true,
      rating: 2,
      episodes: [1, 2, 3],
      watchedAt: "2026-11-05",
    },
    c: { ...empty(title(3)), favorite: true, watchedAt: "2026-11-05" },
  };
  const s = profileStats(entries, new Date(2026, 10, 5));
  expect(s).toMatchObject({
    watched: 2,
    movies: 1,
    series: 1,
    thisMonth: 2,
    activeDays: 2,
    streak: 2,
    reviews: 1,
    average: 3,
  });
  expect(s.months).toHaveLength(6);
  expect(s.months.slice(0, 5).every((m) => m.count === 0)).toBe(true);
});
test("partage : nom choisi et avis, aucune adresse e-mail ni historique privé dans le profil partagé", () => {
  const p = custom(),
    e = {
      ...empty({ ...title(), id: "tmdb-movie-4", source: "tmdb" as const }),
      review: "Mon avis privé avant partage",
      rating: 4,
    };
  const profile = profileShare(p, { [e.title.id]: e });
  expect(profile.text).toContain("Lyra");
  expect(profile.text).not.toContain(e.review);
  expect(profile.text).not.toContain("@");
  const review = reviewShare(p, e);
  expect(review.payload?.review?.text).toBe(e.review);
  expect(review.payload?.review?.rating).toBe(4);
  expect(publicTitleUrl(e.title)).toContain("#/title/tmdb-movie-4");
  expect(
    publicTitleUrl({ ...title(), id: "tmdb-series-7", kind: "series" }),
  ).toBe("https://vela.thomasbarial.com/#/title/tmdb-series-7");
  expect(sharedPageUrl("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
    "https://vela.thomasbarial.com/#/s/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
});
test("la sauvegarde quotidienne inclut le profil et n’est pas validée si son envoi échoue", async () => {
  const service = createBackupService({
    project: "",
    storage,
    now: () => 100000,
    read: () => ({}),
    write: () => {},
    sync: async () => ({ library: {}, uploaded: 0 }),
    afterSync: async () => {
      throw new Error("Profile network failed");
    },
  });
  await expect(service.synchronize("a")).rejects.toThrow("Profile");
  expect(service.state("a").lastSuccess).toBe(0);
  expect(service.state("a").issue?.kind).toBe("network");
});

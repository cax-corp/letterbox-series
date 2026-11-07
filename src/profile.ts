import type { Title } from "./catalog";
export const avatarOptions = [
  { id: "initial", label: "Votre initiale" },
  { id: "smile", label: "Sourire" },
  { id: "wink", label: "Clin d’œil" },
  { id: "grin", label: "Grand sourire" },
  { id: "laugh", label: "Fou rire" },
  { id: "cool", label: "Incognito" },
  { id: "love", label: "Coup de cœur" },
  { id: "starry", label: "Émerveillé" },
  { id: "sleepy", label: "Encore cinq minutes" },
  { id: "surprised", label: "Plot twist" },
  { id: "curious", label: "Intrigué" },
  { id: "unimpressed", label: "Pas convaincu" },
  { id: "grumpy", label: "Grincheux" },
  { id: "shy", label: "Timide" },
  { id: "mischief", label: "Malice" },
  { id: "cheeky", label: "Tire la langue" },
  { id: "zen", label: "Serein" },
  { id: "teary", label: "Ému" },
  { id: "monocle", label: "Le critique" },
  { id: "nerd", label: "Premier rang" },
  { id: "headphones", label: "Bande originale" },
  { id: "stache", label: "Moustache" },
  { id: "cyclops", label: "Œil unique" },
  { id: "alien", label: "D’une autre planète" },
  { id: "mask", label: "Masqué" },
  { id: "astronaut", label: "Astronaute" },
  { id: "cat", label: "Chat de cinéma" },
  { id: "robot", label: "Robot projectionniste" },
  { id: "ghost", label: "Fantôme cinéphile" },
] as const;
export const avatarBackgrounds = [
  {
    id: "theme",
    label: "Couleur du thème",
    color: "var(--brand)",
    ink: "var(--on-brand)",
  },
  {
    id: "theme-soft",
    label: "Nuance du thème",
    color: "var(--primary-container)",
    ink: "var(--on-container)",
  },
  { id: "ocean", label: "Océan", color: "#164C68", ink: "#E4F1F9" },
  { id: "violet", label: "Lavande", color: "#D5CAFA", ink: "#27213A" },
  { id: "amber", label: "Abricot", color: "#F3CE95", ink: "#3F2A13" },
  { id: "coral", label: "Corail", color: "#EA9D94", ink: "#3E2020" },
  { id: "mint", label: "Menthe", color: "#B5DDD0", ink: "#163E35" },
  { id: "slate", label: "Brume", color: "#BED4E0", ink: "#19313F" },
  { id: "rose", label: "Rose", color: "#EABED3", ink: "#3E2030" },
  { id: "midnight", label: "Minuit", color: "#263344", ink: "#E4F1F9" },
] as const;
export type AvatarId = (typeof avatarOptions)[number]["id"];
export type BackgroundId = (typeof avatarBackgrounds)[number]["id"];
export type Profile = {
  version: 1;
  displayName: string;
  bio: string;
  avatar: AvatarId;
  background: BackgroundId;
  featured: Title[];
  updated: string;
};
export const defaultProfile: Profile = {
  version: 1,
  displayName: "",
  bio: "",
  avatar: "initial",
  background: "ocean",
  featured: [],
  updated: "1970-01-01T00:00:00.000Z",
};
const plain = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
export function featuredTitle(t: Title): Title {
  if (
    !/^(?:tmdb-)?(?:movie|series)-\d+$/.test(t.id) ||
    !["movie", "series"].includes(t.kind) ||
    /^(?:tmdb-)?(movie|series)-/.exec(t.id)?.[1] !== t.kind
  )
    throw new Error("Titre favori invalide.");
  return {
    id: t.id,
    kind: t.kind,
    name: plain(t.name).slice(0, 160),
    year: t.year.slice(0, 10),
    image: /^https:\/\//.test(t.image) ? t.image.slice(0, 1000) : "",
    summary: "",
    genres: [],
    ...(t.source && ["tmdb", "itunes", "tvmaze"].includes(t.source)
      ? { source: t.source }
      : {}),
  };
}
export function validateProfile(value: unknown): Profile | null {
  try {
    const p = value as Profile;
    if (
      !p ||
      p.version !== 1 ||
      typeof p.displayName !== "string" ||
      p.displayName.length > 40 ||
      typeof p.bio !== "string" ||
      p.bio.length > 160 ||
      !avatarOptions.some((a) => a.id === p.avatar) ||
      !avatarBackgrounds.some((b) => b.id === p.background) ||
      !Array.isArray(p.featured) ||
      p.featured.length > 4 ||
      typeof p.updated !== "string" ||
      !Number.isFinite(Date.parse(p.updated))
    )
      return null;
    const featured = p.featured.map((t) => featuredTitle(t));
    if (new Set(featured.map((t) => t.id)).size !== featured.length)
      return null;
    return {
      version: 1,
      displayName: plain(p.displayName),
      bio: plain(p.bio),
      avatar: p.avatar,
      background: p.background,
      featured,
      updated: new Date(p.updated).toISOString(),
    };
  } catch {
    return null;
  }
}
export function makeProfile(
  value: Omit<Profile, "version" | "updated">,
  previous: Profile,
  now = Date.now(),
): Profile {
  const profile = validateProfile({
    ...value,
    version: 1,
    updated: new Date(
      Math.max(now, Date.parse(previous.updated) + 1),
    ).toISOString(),
  });
  if (!profile?.displayName)
    throw new Error("Choisissez un nom entre 1 et 40 caractères.");
  return profile;
}
export const profileKey = (project: string, account: string) =>
  `vela-profile-v1:${encodeURIComponent(project.replace(/\/$/, ""))}:${account}`;
export type ProfileRecord = { profile: Profile; synced: string };
export function readProfileRecord(
  project: string,
  account: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): ProfileRecord {
  try {
    const data = JSON.parse(
        storage.getItem(profileKey(project, account)) || "null",
      ),
      profile = validateProfile(data?.profile);
    if (profile)
      return {
        profile,
        synced: typeof data.synced === "string" ? data.synced : "",
      };
  } catch {
    /* Local fallback remains available without Supabase. */
  }
  return { profile: { ...defaultProfile, featured: [] }, synced: "" };
}
export function profilePending(record: ProfileRecord) {
  return (
    record.profile.updated !== defaultProfile.updated &&
    record.profile.updated !== record.synced
  );
}
export function newerProfile(local: Profile, remote: Profile | null) {
  return remote && Date.parse(remote.updated) > Date.parse(local.updated)
    ? remote
    : local;
}

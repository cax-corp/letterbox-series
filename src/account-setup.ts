import type { User } from "@supabase/supabase-js";
import type { Title } from "./catalog";
import { avatarOptions, avatarBackgrounds, type Profile } from "./profile";
import { uploadProfilePhoto, validProfilePhoto } from "./profile-photo";
import { cloud, getConfig, empty, type Library } from "./store";
import { getColourTheme } from "./colour-themes";
import { validateViewing } from "./viewing-preferences";

export type SetupAnswer = "like" | "dislike" | "skip";
export type SetupDraft = {
  version: 1;
  status: "pending" | "complete";
  step: number;
  updated: string;
  firstName: string;
  lastName: string;
  profile: Profile;
  palette: string;
  theme: "dark" | "light" | "system";
  country: string;
  providers: number[];
  titles: Title[];
  answers: Record<string, SetupAnswer>;
};
export const setupPending = () => ({
  version: 1,
  status: "pending",
  step: 0,
  updated: new Date().toISOString(),
});
export const needsAccountSetup = (user: User | null) =>
  user?.user_metadata?.vela_setup?.version === 1 &&
  user.user_metadata.vela_setup.status === "pending";
const draftKey = (account: string) =>
  `vela-setup-v1:${getConfig().url}:${account}`;
export function compactSetupTitle(t: Title): Title {
  return {
    id: t.id,
    kind: t.kind,
    name: t.name.slice(0, 160),
    year: t.year,
    image: t.image,
    summary: t.summary.slice(0, 600),
    genres: t.genres.slice(0, 8),
    genreIds: t.genreIds?.slice(0, 8),
    source: t.source,
    score: t.score,
    voteCount: t.voteCount,
    collectionId: t.collectionId,
  };
}
export function readSetupDraft(user: User, defaults: SetupDraft): SetupDraft {
  const remote = user.user_metadata?.vela_setup;
  let local: any;
  try {
    local = JSON.parse(localStorage.getItem(draftKey(user.id)) || "null");
  } catch {}
  const r =
    local?.version === 1 &&
    Date.parse(local.updated) >= (Date.parse(remote?.updated || "") || 0)
      ? local
      : remote;
  if (
    !r ||
    r.version !== 1 ||
    !["pending", "complete"].includes(r.status) ||
    (r.status === "complete" && remote?.status === "complete")
  )
    return defaults;
  const profile = { ...defaults.profile };
  if (
    r.profile &&
    avatarOptions.some((a) => a.id === r.profile.avatar) &&
    avatarBackgrounds.some((a) => a.id === r.profile.background)
  ) {
    profile.avatar = r.profile.avatar;
    profile.photo = validProfilePhoto(r.profile.photo)
      ? r.profile.photo
      : undefined;
    profile.background = r.profile.background;
    profile.displayName =
      typeof r.profile.displayName === "string"
        ? r.profile.displayName.slice(0, 40)
        : profile.displayName;
  }
  const titles: Title[] = Array.isArray(r.titles)
    ? r.titles
        .filter(
          (t: any) =>
            t &&
            /^(?:tmdb-)?movie-\d+$/.test(t.id) &&
            t.kind === "movie" &&
            typeof t.name === "string" &&
            typeof t.year === "string" &&
            typeof t.image === "string" &&
            typeof t.summary === "string" &&
            (!t.genreIds ||
              (Array.isArray(t.genreIds) &&
                t.genreIds.every(Number.isInteger))) &&
            Array.isArray(t.genres) &&
            t.genres.every((g: unknown) => typeof g === "string"),
        )
        .slice(0, 5)
        .map(compactSetupTitle)
    : [];
  const viewing = validateViewing({
    version: 1,
    country: r.country,
    providers: r.providers,
    updated: r.updated,
  });
  return {
    ...defaults,
    step: Number.isInteger(r.step) && r.step >= 0 && r.step <= 3 ? r.step : 0,
    firstName:
      typeof r.firstName === "string"
        ? r.firstName.slice(0, 60)
        : defaults.firstName,
    lastName:
      typeof r.lastName === "string"
        ? r.lastName.slice(0, 60)
        : defaults.lastName,
    profile,
    country: viewing?.country || defaults.country,
    providers: viewing?.providers || defaults.providers,
    palette: getColourTheme(r.palette || defaults.palette).id,
    theme: ["dark", "light", "system"].includes(r.theme)
      ? r.theme
      : defaults.theme,
    titles,
    answers: Object.fromEntries(
      titles.flatMap((t) =>
        ["like", "dislike", "skip"].includes(r.answers?.[t.id])
          ? [[t.id, r.answers[t.id]]]
          : [],
      ),
    ),
    updated: Number.isFinite(Date.parse(r.updated))
      ? r.updated
      : defaults.updated,
  };
}
export function cacheSetup(account: string, value: SetupDraft) {
  try {
    localStorage.setItem(draftKey(account), JSON.stringify(value));
  } catch {}
}
export async function saveSetupProgress(
  account: string,
  value: SetupDraft,
  language: string,
) {
  cacheSetup(account, value);
  if (!cloud) throw new Error("service unavailable");
  const current = await cloud.auth.getSession();
  if (current.error || current.data.session?.user.id !== account)
    throw new Error("account changed");
  const profile = await uploadProfilePhoto(cloud, account, value.profile);
  const active = await cloud.auth.getSession();
  if (active.error || active.data.session?.user.id !== account)
    throw new Error("account changed");
  const stored = { ...value, profile };
  cacheSetup(account, stored);
  const { titles: _titles, answers: _answers, ...progress } = stored;
  const result = await cloud.auth.updateUser({
    data: {
      vela_setup: progress,
      vela_profile: profile,
      first_name: value.firstName.trim(),
      last_name: value.lastName.trim(),
      vela_viewing: {
        version: 1,
        country: value.country,
        providers: value.providers,
        updated: value.updated,
      },
      vela_language: { version: 1, code: language, updated: value.updated },
    },
  });
  if (result.error) throw result.error;
  if (
    result.data.user?.id !== account ||
    result.data.user.user_metadata?.vela_setup?.updated !== value.updated
  )
    throw new Error("setup not confirmed");
  return profile;
}
export function chooseSetupTitles(
  pool: Title[],
  excluded: ReadonlySet<string>,
  random = Math.random,
) {
  const unique = [
    ...new Map(
      pool
        .filter(
          (t) =>
            t.kind === "movie" &&
            !excluded.has(t.id) &&
            t.year &&
            Number(t.year) <= new Date().getFullYear(),
        )
        .map((t) => [t.id, t]),
    ).values(),
  ];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  const chosen: Title[] = [],
    used = new Map<number, number>(),
    families = new Set<number>();
  while (unique.length && chosen.length < 5) {
    const score = (t: Title) =>
      (t.genreIds || []).reduce(
        (n, g) => n + (used.has(g) ? -0.5 * used.get(g)! : 2),
        0,
      ) - (t.collectionId && families.has(t.collectionId) ? 6 : 0);
    unique.sort((a, b) => score(b) - score(a));
    const t = unique.shift()!;
    chosen.push(compactSetupTitle(t));
    for (const g of t.genreIds || []) used.set(g, (used.get(g) || 0) + 1);
    if (t.collectionId) families.add(t.collectionId);
  }
  return chosen;
}
export function applySetupAnswers(
  library: Library,
  draft: Pick<SetupDraft, "titles" | "answers">,
): Library {
  const next = { ...library };
  for (const title of draft.titles) {
    const answer = draft.answers[title.id],
      old = library[title.id];
    if (
      !answer ||
      answer === "skip" ||
      old?.rating ||
      old?.favorite ||
      old?.recommendationFeedback
    )
      continue;
    const now = new Date().toISOString();
    next[title.id] = {
      ...(old || empty(title)),
      recommendationFeedback: answer,
      updated: now,
      preferenceUpdated: now,
    };
  }
  return next;
}

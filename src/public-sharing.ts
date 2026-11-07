import { t as tr } from "./i18n";
import { cloud } from "./store";
import {
  validateProfile,
  featuredTitle,
  defaultProfile,
  type Profile,
} from "./profile";
import type { Entry, Library } from "./store";
import { profileStats } from "./profile-stats";
import type { Title } from "./catalog";

export type PublicStats = {
  watched: number;
  favorites: number;
  reviews: number;
  average: number | null;
};
export type SharedPayload = {
  version: 1;
  profile: Profile;
  stats?: PublicStats;
  review?: { title: Title; rating: number; text: string; updated: string };
};
export type ShareDraft = {
  kind: "profile" | "review" | "title";
  heading: string;
  text: string;
  url?: string;
  target: string;
  payload?: SharedPayload;
};
export type SharedPage = {
  id: string;
  kind: "profile" | "review";
  payload: SharedPayload;
  updated_at: string;
};
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const live = new Map<string, Promise<SharedPage>>();
function publicProfile(p: Profile, fallback: string): Profile {
  return {
    ...defaultProfile,
    displayName: p.displayName.trim().slice(0, 40) || fallback,
    bio: p.bio,
    avatar: p.avatar,
    background: p.background,
    featured: p.featured.map(featuredTitle),
    updated: p.updated,
  };
}
export function profileDraft(
  profile: Profile,
  library: Library,
  fallback = tr("Mon profil Vela"),
): ShareDraft {
  const p = publicProfile(profile, fallback),
    stats = profileStats(library);
  return {
    kind: "profile",
    heading: tr("{0} sur Vela", p.displayName),
    text: tr("Le profil de {0} sur Vela", p.displayName),
    target: "profile",
    payload: {
      version: 1,
      profile: p,
      stats: {
        watched: stats.watched,
        favorites: stats.favorites,
        reviews: stats.reviews,
        average: stats.average,
      },
    },
  };
}
export function reviewDraft(
  profile: Profile,
  entry: Entry,
  fallback = tr("Un regard sur Vela"),
): ShareDraft {
  if (!entry.review.trim())
    throw new Error(tr("Enregistrez un avis avant de le partager."));
  const p = publicProfile(profile, fallback);
  return {
    kind: "review",
    heading: tr("{0} · L’avis de {1}", entry.title.name, p.displayName),
    text: tr("{0} a donné son avis sur {1}", p.displayName, entry.title.name),
    target: entry.title.id,
    payload: {
      version: 1,
      profile: p,
      review: {
        title: featuredTitle(entry.title),
        rating: entry.rating,
        text: entry.review.trim(),
        updated: entry.updated,
      },
    },
  };
}
export function validateSharedPage(value: unknown): SharedPage | null {
  try {
    const v = value as SharedPage;
    if (
      !v ||
      !uuidPattern.test(v.id) ||
      !["profile", "review"].includes(v.kind) ||
      v.payload?.version !== 1
    )
      return null;
    const profile = validateProfile(v.payload.profile);
    if (!profile?.displayName) return null;
    const p: SharedPayload = { version: 1, profile };
    if (v.kind === "profile") {
      const s = v.payload.stats;
      if (
        !s ||
        ![s.watched, s.favorites, s.reviews].every(
          (n) => Number.isSafeInteger(n) && n >= 0 && n <= 10000000,
        ) ||
        !(
          s.average === null ||
          (Number.isFinite(s.average) && s.average >= 0 && s.average <= 5)
        )
      )
        return null;
      p.stats = {
        watched: s.watched,
        favorites: s.favorites,
        reviews: s.reviews,
        average: s.average,
      };
    } else {
      const r = v.payload.review;
      if (
        !r ||
        typeof r.text !== "string" ||
        !r.text.trim() ||
        r.text.length > 5000 ||
        !Number.isFinite(r.rating) ||
        r.rating < 0 ||
        r.rating > 5 ||
        !Number.isFinite(Date.parse(r.updated))
      )
        return null;
      p.review = {
        title: featuredTitle(r.title),
        text: r.text,
        rating: r.rating,
        updated: r.updated,
      };
    }
    return { id: v.id, kind: v.kind, payload: p, updated_at: v.updated_at };
  } catch {
    return null;
  }
}
export function shareError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (
    ["42P01", "PGRST205"].includes(e?.code || "") ||
    /schema cache|vela_shares.*does not exist/i.test(e?.message || "")
  )
    return tr(
      "Le partage public doit être activé dans Supabase avec le script public-sharing.sql. Le guide est dans Réglages → Liens publics.",
    );
  return (
    e?.message || tr("Impossible de joindre le service de partage. Réessayez.")
  );
}
export async function publishShare(draft: ShareDraft): Promise<SharedPage> {
  if (!cloud || !draft.payload || draft.kind === "title")
    throw new Error(
      tr("Connectez-vous pour créer un lien public de profil ou d’avis."),
    );
  const { data, error } = await cloud.auth.getSession();
  if (error) throw error;
  const account = data.session?.user.id;
  if (!account)
    throw new Error(
      tr("Connectez-vous pour créer un lien public de profil ou d’avis."),
    );
  const key = JSON.stringify([
    account,
    draft.kind,
    draft.target,
    draft.payload,
  ]);
  const running = live.get(key);
  if (running) return running;
  const job = (async () => {
    const result = await cloud
      .from("vela_shares")
      .upsert(
        {
          owner_id: account,
          kind: draft.kind,
          target: draft.target,
          payload: draft.payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,kind,target" },
      )
      .select("id,kind,payload,updated_at")
      .single();
    if (result.error) throw new Error(shareError(result.error));
    const page = validateSharedPage(result.data);
    if (!page) throw new Error(tr("Le lien public n’a pas pu être confirmé."));
    return page;
  })().finally(() => live.delete(key));
  live.set(key, job);
  return job;
}
export async function readSharedPage(id: string, signal: AbortSignal) {
  if (!cloud || !uuidPattern.test(id))
    throw new Error(tr("Ce lien public n’est plus disponible."));
  const result = await cloud
    .from("vela_shares")
    .select("id,kind,payload,updated_at")
    .eq("id", id)
    .abortSignal(signal)
    .maybeSingle();
  if (result.error) throw new Error(shareError(result.error));
  const page = validateSharedPage(result.data);
  if (!page)
    throw new Error(
      tr(
        "Ce lien public n’est plus disponible. Il a peut-être été retiré par son auteur.",
      ),
    );
  return page;
}

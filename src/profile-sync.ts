import { t as tr } from "./i18n";
import { cloud, getConfig } from "./store";
import { uploadProfilePhoto } from "./profile-photo";
import {
  newerProfile,
  profileKey,
  profilePending,
  readProfileRecord,
  validateProfile,
  type Profile,
  type ProfileRecord,
} from "./profile";
export const profileProject = () => getConfig().url || "";
export function readCurrentProfile(account = "local") {
  return readProfileRecord(profileProject(), account);
}
export function writeProfileRecord(account: string, record: ProfileRecord) {
  localStorage.setItem(
    profileKey(profileProject(), account),
    JSON.stringify(record),
  );
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("vela-profile-state", { detail: account }),
    );
}
export function hydrateProfile(account: string, value: unknown) {
  const remote = validateProfile(value);
  if (!remote) return;
  const local = readCurrentProfile(account),
    chosen = newerProfile(local.profile, remote);
  if (
    chosen === remote ||
    (local.profile.updated === remote.updated &&
      JSON.stringify(local.profile) === JSON.stringify(remote))
  )
    writeProfileRecord(account, { profile: chosen, synced: remote.updated });
}
const flights = new Map<string, Promise<void>>();
/** The profile holds a small photo URL; image bytes go to Storage, never Auth metadata. */
export async function syncUserProfile(
  account: string,
  client = cloud,
): Promise<void> {
  if (!client || account === "local") return;
  const key = profileKey(profileProject(), account),
    existing = flights.get(key);
  if (existing) return existing;
  const job = Promise.resolve()
    .then(async () => {
      const { data: session, error: sessionError } =
        await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (session.session?.user.id !== account) return;
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (data.user?.id !== account) return;
      const remote = validateProfile(data.user.user_metadata?.vela_profile),
        local = readCurrentProfile(account);
      const chosen = newerProfile(local.profile, remote);
      if (chosen === remote) {
        writeProfileRecord(account, {
          profile: chosen,
          synced: chosen.updated,
        });
        return;
      }
      if (!profilePending(local)) return;
      if (remote && JSON.stringify(remote) === JSON.stringify(local.profile)) {
        writeProfileRecord(account, {
          profile: local.profile,
          synced: remote.updated,
        });
        return;
      }
      const sent = await uploadProfilePhoto(client, account, local.profile);
      if (sent !== local.profile) {
        const current = await client.auth.getSession();
        if (current.error || current.data.session?.user.id !== account) return;
        const latest = readCurrentProfile(account);
        // A concurrent edit keeps its name/bio; a new photograph is never overwritten.
        if (latest.profile.photo === local.profile.photo) {
          writeProfileRecord(account, {
            profile: { ...latest.profile, photo: sent.photo },
            synced: latest.synced,
          });
        }
      }
      const { data: result, error: updateError } = await client.auth.updateUser(
        { data: { vela_profile: sent } },
      );
      if (updateError) throw updateError;
      if (result.user?.id !== account)
        throw new Error(tr("Le profil n’a pas pu être confirmé par Supabase."));
      const confirmed = validateProfile(
        result.user.user_metadata?.vela_profile,
      );
      if (!confirmed || JSON.stringify(confirmed) !== JSON.stringify(sent))
        throw new Error(tr("Le profil n’a pas pu être confirmé par Supabase."));
      const latest = readCurrentProfile(account);
      writeProfileRecord(account, {
        profile: latest.profile,
        synced: sent.updated,
      });
    })
    .finally(() => flights.delete(key));
  flights.set(key, job);
  return job;
}

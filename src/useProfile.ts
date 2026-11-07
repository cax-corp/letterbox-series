import { t as tr } from "./i18n";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  makeProfile,
  newerProfile,
  validateProfile,
  profilePending,
  type Profile,
} from "./profile";
import {
  hydrateProfile,
  readCurrentProfile,
  syncUserProfile,
  writeProfileRecord,
} from "./profile-sync";
export function useProfile(user: User | null) {
  const account = user?.id || "local",
    owner = useRef(account);
  owner.current = account;
  const [value, setValue] = useState(() => ({
    account,
    record: readCurrentProfile(account),
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const record =
    value.account === account ? value.record : readCurrentProfile(account);
  useEffect(() => {
    setValue({ account, record: readCurrentProfile(account) });
    setBusy(false);
    setError("");
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail === account) {
        const next = readCurrentProfile(account);
        setValue({ account, record: next });
        if (!profilePending(next)) setError("");
      }
    };
    const storage = () =>
      setValue({ account, record: readCurrentProfile(account) });
    window.addEventListener("vela-profile-state", refresh);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("vela-profile-state", refresh);
      window.removeEventListener("storage", storage);
    };
  }, [account]);
  useEffect(() => {
    if (user) hydrateProfile(user.id, user.user_metadata?.vela_profile);
  }, [user?.id, user?.user_metadata?.vela_profile]);
  async function save(draft: Omit<Profile, "version" | "updated">) {
    const previous = newerProfile(
      readCurrentProfile(account).profile,
      user ? validateProfile(user.user_metadata?.vela_profile) : null,
    );
    const profile = makeProfile(draft, previous);
    writeProfileRecord(account, {
      profile,
      synced: readCurrentProfile(account).synced,
    });
    setError("");
    if (!user || navigator.onLine === false) return "local" as const;
    setBusy(true);
    try {
      await syncUserProfile(account);
      return profilePending(readCurrentProfile(account))
        ? ("local" as const)
        : ("cloud" as const);
    } catch {
      if (owner.current === account)
        setError(
          tr(
            "Profil enregistré sur cet appareil. La synchronisation Supabase sera réessayée avec la sauvegarde.",
          ),
        );
      return "local" as const;
    } finally {
      if (owner.current === account) setBusy(false);
    }
  }
  return {
    profile: newerProfile(
      record.profile,
      user ? validateProfile(user.user_metadata?.vela_profile) : null,
    ),
    pending: profilePending(record),
    busy,
    error,
    save,
  };
}

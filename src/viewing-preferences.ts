import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud, getConfig } from "./store";
const codes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
export const countries = codes
  .map((code) => ({
    code,
    name: countryNames.of(code) || code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));
export type ViewingPreferences = {
  version: 1;
  country: string;
  providers: number[];
  updated: string;
};
export const emptyViewing: ViewingPreferences = {
  version: 1,
  country: "",
  providers: [],
  updated: "1970-01-01T00:00:00.000Z",
};
export function validateViewing(value: unknown): ViewingPreferences | null {
  const v = value as ViewingPreferences;
  if (
    !v ||
    v.version !== 1 ||
    (v.country !== "" && !codes.includes(v.country)) ||
    !Array.isArray(v.providers) ||
    v.providers.length > 100 ||
    !v.providers.every((id) => Number.isSafeInteger(id) && id > 0) ||
    !Number.isFinite(Date.parse(v.updated))
  )
    return null;
  return {
    version: 1,
    country: v.country,
    providers: [...new Set(v.providers)],
    updated: v.updated,
  };
}
const key = (account: string) =>
  `vela-viewing-v1:${getConfig().url || "local"}:${account}`;
function read(account: string, metadata?: unknown) {
  let local: ViewingPreferences | null = null;
  try {
    local = validateViewing(
      JSON.parse(localStorage.getItem(key(account)) || "null"),
    );
  } catch {}
  const remote = validateViewing(metadata);
  return remote &&
    (!local || Date.parse(remote.updated) > Date.parse(local.updated))
    ? remote
    : local || { ...emptyViewing, providers: [] };
}
const flights = new Map<string, Promise<void>>();
export async function syncViewingPreferences(account: string) {
  if (!cloud || account === "local") return;
  const existing = flights.get(account);
  if (existing) return existing;
  const job = (async () => {
    const { data: sessionData, error: sessionError } =
      await cloud.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (session?.user.id !== account) return;
    // Bind writes to this account's token, even if the UI signs into another account meanwhile.
    const { data, error } = await cloud.auth.getUser(session.access_token);
    if (error) throw error;
    if (data.user?.id !== account) return;
    let remote = validateViewing(data.user.user_metadata?.vela_viewing);
    for (let pass = 0; pass < 4; pass++) {
      const chosen = read(account, remote);
      localStorage.setItem(key(account), JSON.stringify(chosen));
      if (
        !chosen.country ||
        (remote && Date.parse(chosen.updated) <= Date.parse(remote.updated))
      )
        break;
      const config = getConfig();
      const response = await fetch(`${config.url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: config.key,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ data: { vela_viewing: chosen } }),
      });
      const result = await response.json();
      if (!response.ok || result.id !== account)
        throw new Error(
          result.msg || "La synchronisation des services a échoué.",
        );
      remote = validateViewing(result.user_metadata?.vela_viewing);
      if (!remote || remote.updated !== chosen.updated)
        throw new Error("Les préférences n’ont pas pu être confirmées.");
    }
    window.dispatchEvent(
      new CustomEvent("vela-viewing-state", { detail: account }),
    );
  })().finally(() => flights.delete(account));
  flights.set(account, job);
  return job;
}
export function useViewingPreferences(user: User | null) {
  const account = user?.id || "local";
  const [, setRevision] = useState(0),
    [message, setMessage] = useState("");
  const value = read(account, user?.user_metadata?.vela_viewing);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener("vela-viewing-state", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vela-viewing-state", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    // Persist signup metadata locally without any extra request.
    const next = read(account, user?.user_metadata?.vela_viewing);
    try {
      localStorage.setItem(key(account), JSON.stringify(next));
    } catch {}
    setRevision((n) => n + 1);
    setMessage("");
  }, [account, user?.user_metadata?.vela_viewing]);
  useEffect(() => {
    if (!user || navigator.onLine === false) return;
    let active = true;
    syncViewingPreferences(account).catch(() => {
      if (active)
        setMessage(
          "Les préférences restent disponibles sur cet appareil. La synchronisation sera réessayée avec la sauvegarde.",
        );
    });
    return () => {
      active = false;
    };
  }, [account]);
  function save(country: string, providers: number[]) {
    const next = validateViewing({
      version: 1,
      country,
      providers,
      updated: new Date(
        Math.max(Date.now(), Date.parse(value.updated) + 1),
      ).toISOString(),
    });
    if (!next) {
      setMessage("Choisissez un pays valide.");
      return;
    }
    try {
      localStorage.setItem(key(account), JSON.stringify(next));
      setRevision((n) => n + 1);
      setMessage("Préférences enregistrées.");
    } catch {
      setMessage("Le stockage de cet appareil est plein.");
      return;
    }
    if (user)
      syncViewingPreferences(account).catch(() =>
        setMessage(
          "Enregistré sur cet appareil. La synchronisation du pays et des services sera réessayée avec votre sauvegarde.",
        ),
      );
  }
  return { value, save, message };
}

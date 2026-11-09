import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entry, Library } from "./store";
type Fingerprint = { title_id: string; updated: string; fingerprint: string };
const unavailable = new WeakMap<object, number>();
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function entryFingerprint(entry: Entry) {
  const bytes = new TextEncoder().encode(canonicalJson(entry));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
/** Optional SQL capability. Old projects keep the proven full-read synchronizer. */
export async function readLibraryManifest(
  client: SupabaseClient,
  account: string,
  signal: AbortSignal,
): Promise<Fingerprint[] | null> {
  if (
    !/^[0-9a-f-]{36}$/i.test(account) ||
    typeof client.rpc !== "function" ||
    !globalThis.crypto?.subtle ||
    Date.now() < (unavailable.get(client) || 0)
  )
    return null;
  const rows: Fingerprint[] = [];
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .rpc("vela_library_fingerprints")
        .order("title_id", { ascending: true })
        .range(offset, offset + 999)
        .abortSignal(signal)
        .retry(false);
      if (error) {
        if (error.code === "42501" || error.code === "PGRST301") throw error;
        unavailable.set(client, Date.now() + 3600000);
        return null;
      }
      if (
        !Array.isArray(data) ||
        !data.every(
          (row) =>
            row &&
            /^(tmdb-)?(movie|series)-\d+$/.test(row.title_id) &&
            Number.isFinite(Date.parse(row.updated)) &&
            /^[a-f0-9]{64}$/.test(row.fingerprint),
        )
      ) {
        unavailable.set(client, Date.now() + 3600000);
        return null;
      }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  } catch (error) {
    if (signal.aborted || (error as { code?: string }).code === "42501")
      throw error;
    unavailable.set(client, Date.now() + 60000);
    return null;
  }
}
export async function compareManifest(rows: Fingerprint[], local: Library) {
  const matching: Library = {},
    download: string[] = [];
  for (let offset = 0; offset < rows.length; offset += 40) {
    await Promise.all(
      rows.slice(offset, offset + 40).map(async (row) => {
        const entry = local[row.title_id];
        if (entry && (await entryFingerprint(entry)) === row.fingerprint)
          matching[row.title_id] = entry;
        else download.push(row.title_id);
      }),
    );
  }
  return { matching, download };
}

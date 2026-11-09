import type { SupabaseClient } from "@supabase/supabase-js";
type Read = ReturnType<SupabaseClient["auth"]["getUser"]>;
const flights = new WeakMap<object, Map<string, Read>>();
/** Share concurrent reads only; never cache a user across accounts or later sync rounds. */
export function readRemoteUser(
  client: SupabaseClient,
  account: string,
  token?: string,
): Read {
  let pending = flights.get(client);
  if (!pending) {
    pending = new Map();
    flights.set(client, pending);
  }
  const key = account + ":" + (token || "session"),
    old = pending.get(key);
  if (old) return old;
  const job = Promise.resolve()
    .then(() => client.auth.getUser(token))
    .finally(() => {
      if (pending!.get(key) === job) pending!.delete(key);
    });
  pending.set(key, job);
  return job;
}

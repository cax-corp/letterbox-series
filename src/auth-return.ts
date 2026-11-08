// Capture before Supabase consumes the credentials in the URL. Never persist or log them.
export function readAuthReturn(href: string) {
  const url = new URL(href),
    hash = new URLSearchParams(url.hash.slice(1));
  if (
    url.searchParams.get("auth") !== "confirm" &&
    hash.get("type") !== "signup"
  )
    return null;
  return {
    accessToken: hash.get("access_token"),
    error:
      hash.get("error_code") ||
      hash.get("error") ||
      url.searchParams.get("error_code") ||
      url.searchParams.get("error"),
  };
}
export const authReturn =
  typeof location === "undefined" ? null : readAuthReturn(location.href);

import { Capacitor } from "@capacitor/core";
import { webBaseUrl } from "./sharing";
export function confirmationUrl() {
  const base = Capacitor.isNativePlatform()
    ? webBaseUrl()
    : location.origin + location.pathname;
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("auth", "confirm");
  return url.href;
}

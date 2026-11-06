import { test, expect } from "@playwright/test";
import { safeWatchLink, providerDirectLink } from "../src/direct-watch-links";
test("liens de lecture : domaines officiels, vrais chemins et correspondance avec le service", () => {
  const netflix = safeWatchLink("https://www.netflix.com/title/123")!;
  expect(providerDirectLink("Netflix Standard with Ads", [netflix])).toBe(
    netflix.url,
  );
  expect(providerDirectLink("Prime Video", [netflix])).toBeUndefined();
  for (const url of [
    "javascript:alert(1)",
    "https://netflix.com.evil.example/title/123",
    "https://evil.example/title/123",
    "https://www.netflix.com/",
    "https://www.netflix.com/search",
    "https://www.amazon.com/dp/B000PHYSICAL",
    "https://user:password@www.netflix.com/title/123",
    "https://www.netflix.com:8443/title/123",
  ])
    expect(safeWatchLink(url), url).toBe(null);
  expect(safeWatchLink("http://www.netflix.com/title/123")?.url).toBe(
    "https://www.netflix.com/title/123",
  );
});

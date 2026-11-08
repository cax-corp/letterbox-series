import { test, expect, type Page } from "./fixtures";

async function prepare(page: Page, muted = false) {
  await page.addInitScript((muted) => {
    localStorage.setItem("vela-taste-sound-v1", muted ? "off" : "on");
    const Original = window.Audio;
    (window as any).spaceTracks = [];
    (window as any).Audio = function (
      ...args: ConstructorParameters<typeof Audio>
    ) {
      const audio = new Original(...args);
      (window as any).spaceTracks.push(audio);
      return audio;
    };
  }, muted);
  await page.route("**/itunes.apple.com/**", (r) =>
    r.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api.tvmaze.com/**", (r) => r.fulfill({ json: [] }));
  await page.goto("/#settings/tastes");
}
async function track(page: Page) {
  return page.evaluate(() => {
    const a: HTMLAudioElement | undefined = (window as any).spaceTracks.at(-1);
    return a
      ? {
          paused: a.paused,
          loop: a.loop,
          time: a.currentTime,
          duration: a.duration,
          src: a.getAttribute("src"),
          volume: a.volume,
          count: (window as any).spaceTracks.length,
        }
      : null;
  });
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await expect
    .poll(async () => (await track(page))?.time || 0)
    .toBeGreaterThan(0);
}

test("Spacewalk : aucun chargement avant ouverture, vrai MP3 complet, boucle et libération en quittant la carte", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("spacewalk.mp3")) requests.push(r.url());
  });
  await prepare(page);
  expect(await track(page)).toBeNull();
  expect(requests).toHaveLength(0);
  await start(page);
  await expect
    .poll(async () => (await track(page))?.duration || 0)
    .toBeGreaterThan(180);
  const playing = (await track(page))!;
  expect(playing.loop).toBe(true);
  expect(playing.volume).toBeCloseTo(0.4);
  expect(playing.src).toMatch(/\/audio\/spacewalk\.mp3$/);
  expect(playing.duration).toBeLessThan(185);
  // Cross the real end of the file: a loop flag alone would not prove decoding/replay works.
  await page.evaluate(() => {
    const a = (window as any).spaceTracks[0];
    a.currentTime = a.duration - 0.15;
  });
  await expect.poll(async () => (await track(page))!.time).toBeLessThan(2);
  await expect
    .poll(async () => (await track(page))?.time || 0)
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  expect((await track(page))!.count).toBe(1);
  await page
    .getByRole("button", { name: "Lire la carte", exact: true })
    .click();
  await expect(page.locator(".stellar-help")).toContainText(
    "Spacewalk — Punch Deck",
  );
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await expect.poll(async () => (await track(page))?.paused).toBe(true);
  expect((await track(page))!.src).toBeNull();
  await page
    .getByRole("button", { name: "Carte de mes goûts", exact: true })
    .click();
  expect((await track(page))!.count).toBe(1);
  await start(page);
  expect((await track(page))!.count).toBe(2);
  expect(await page.evaluate(() => (window as any).spaceTracks[0].paused)).toBe(
    true,
  );
});

test("Spacewalk : silence mémorisé, bouton commun et pause/reprise lors des changements de visibilité et d’état natif", async ({
  page,
}) => {
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  expect(await track(page)).toBeNull();
  const sound = page.getByRole("button", {
    name: "Son de la carte",
    exact: true,
  });
  await sound.click();
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await sound.click();
  await expect.poll(async () => (await track(page))?.paused).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("vela-taste-sound-v1")),
  ).toBe("off");
  await sound.click();
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await track(page))?.paused).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await page.evaluate(() => document.dispatchEvent(new Event("pause")));
  await expect.poll(async () => (await track(page))?.paused).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await page
    .getByRole("button", { name: "Retour aux réglages", exact: true })
    .click();
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  expect((await track(page))!.paused).toBe(true);
});

test("Spacewalk : un refus de lecture laisse un bouton pour relancer et n’empêche pas d’explorer", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    const original = HTMLMediaElement.prototype.play;
    let first = true;
    HTMLMediaElement.prototype.play = function () {
      if (first && this.src.includes("spacewalk.mp3")) {
        first = false;
        return Promise.reject(
          new DOMException("Gesture required", "NotAllowedError"),
        );
      }
      return original.call(this);
    };
  });
  await page
    .getByRole("button", { name: "Démarrer la carte", exact: true })
    .click();
  const sound = page.getByRole("button", {
    name: "Son de la carte",
    exact: true,
  });
  await expect(sound).toContainText("Activer le son");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect.poll(async () => (await track(page))?.paused).toBe(false);
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".taste-scene")).toBeVisible();
});

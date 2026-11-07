import { test, expect, type Page } from "./fixtures";
test.use({ hasTouch: true, isMobile: true });
const key = "1234567890abcdef1234567890abcdef";
const raw = (id: number) => ({
  id,
  title: `Film ${id}`,
  original_title: `Film ${id}`,
  release_date: "2024-01-01",
  overview: "Une aventure aux limites du monde connu.",
  genre_ids: [878],
  poster_path: "/poster.svg",
  backdrop_path: "/scene.svg",
  vote_count: 100,
  vote_average: 8,
});
async function setup(page: Page, native = true) {
  // Exercise the APK feed. The production website deliberately shows its mobile notice.
  await page.addInitScript(
    ({ k, native }) => {
      if (native) {
        const w = window as any;
        localStorage.setItem("vela-welcome-v1", "done");
        w.CapacitorCustomPlatform = { name: "android" };
        const cap = (w.Capacitor ||= {});
        cap.PluginHeaders ||= [
          {
            name: "SystemBars",
            methods: [{ name: "setStyle", rtype: "promise" }],
          },
          {
            name: "LumaAppearance",
            methods: [{ name: "setTheme", rtype: "promise" }],
          },
        ];
        cap.nativePromise ||= async () => ({});
      }
      localStorage.setItem("luma-tmdb-token", k);
      if (!localStorage.getItem("luma-library-v1"))
        localStorage.setItem(
          "luma-library-v1",
          JSON.stringify({
            "tmdb-movie-100": {
              title: {
                id: "tmdb-movie-100",
                kind: "movie",
                source: "tmdb",
                name: "Mon favori",
                year: "2014",
                image: "",
                summary: "",
                genres: ["Science-fiction"],
              },
              watched: true,
              rating: 5,
              favorite: true,
              watchlist: false,
              review: "Note privée",
              updated: "2026-11-05T00:00:00Z",
              watchedAt: "2026-11-05",
              episodes: [],
            },
          }),
        );
    },
    { k: key, native },
  );
  const calls: string[] = [];
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const u = new URL(r.request().url());
    calls.push(u.pathname + u.search);
    const n = Number(u.searchParams.get("page") || 1);
    if (/\/movie\/\d+$/.test(u.pathname)) {
      const id = Number(u.pathname.split("/").at(-1));
      return r.fulfill({
        json: {
          ...raw(id),
          runtime: 123,
          genres: [{ id: 878, name: "Science-fiction" }],
          videos: { results: [] },
          external_ids: {},
        },
      });
    }
    if (u.pathname.includes("/tv/"))
      return r.fulfill({ json: { results: [], total_pages: 1 } });
    return r.fulfill({
      json: {
        results: Array.from({ length: 20 }, (_, i) =>
          raw((n - 1) * 20 + i + 1),
        ),
        total_pages: 3,
        total_results: 60,
      },
    });
  });
  await page.route("https://image.tmdb.org/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><radialGradient id="g"><stop stop-color="#009fe3"/><stop offset="1" stop-color="#10202d"/></radialGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="850" cy="260" r="150" fill="#4aa0c4" opacity=".3"/></svg>',
    }),
  );
  return calls;
}
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Film 1", exact: true }),
  ).toBeVisible();
}
test("fil compact : carte dans la zone utile, pagination automatique et DOM virtualisé", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await expect(
    page.getByRole("button", { name: "Varier la sélection" }),
  ).toHaveCount(0);
  await expect(page.getByText("Votre prochain")).toHaveCount(0);
  const feed = page.getByRole("feed", { name: "Films recommandés" });
  const card = page.getByRole("article", { name: "Film 1", exact: true });
  const f = await feed.boundingBox(),
    c = await card.boundingBox();
  expect(c!.y).toBeLessThan(100);
  expect(c!.height).toBeLessThan(f!.height);
  expect(c!.height).toBeGreaterThan(f!.height - 50);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (let i = 0; i < 28 && !calls.some((u) => u.includes("page=2")); i++) {
    const before = await feed.evaluate((el) => ({
      top: el.scrollTop,
      height: el.scrollHeight,
    }));
    await feed.press("PageDown");
    await expect
      .poll(
        async () =>
          calls.some((u) => u.includes("page=2")) ||
          (await feed.evaluate(
            (el, previous) =>
              el.scrollTop > previous.top + 1 ||
              el.scrollHeight > previous.height,
            before,
          )),
      )
      .toBe(true);
  }
  expect(calls.some((u) => u.includes("page=2"))).toBe(true);
  expect(await page.locator(".recommendation-card").count()).toBeLessThan(10);
  await page.screenshot({ path: "tests/recommendations-infinite.png" });
});
test("double clic : À voir sans créer de favori, pas de saut du fil ; refus persistant", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const card = page.getByRole("article", { name: "Film 1", exact: true });
  await card.getByRole("heading", { name: "Film 1", exact: true }).dblclick();
  await expect(
    card.getByRole("button", { name: "Retirer Film 1 de ma liste" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    card.getByRole("button", { name: "J’aime Film 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(card).toBeVisible();
  await expect(page.locator(".like-burst")).toContainText("À voir");
  expect(calls.some((url) => url.includes("/movie/1/recommendations"))).toBe(
    false,
  );
  const before = await page.getByRole("feed").evaluate((el) => el.scrollTop);
  await card
    .getByRole("button", { name: "Retirer Film 1 de ma liste" })
    .click();
  expect(await page.getByRole("feed").evaluate((el) => el.scrollTop)).toBe(
    before,
  );
  await card
    .getByRole("button", { name: "Je n’aime pas Film 1", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("luma-library-v1") || "{}")[
        "tmdb-movie-1"
      ],
  );
  expect(stored.recommendationFeedback).toBe("dislike");
  expect(stored.favorite).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.locator(".recommendation-card").first()).toBeVisible();
  await expect(card).toHaveCount(0);
});
test("un geste de scroll ne déclenche pas J’aime et les contrôles ont une alternative au double-tap", async ({
  page,
}) => {
  await setup(page);
  await enter(page);
  const card = page.getByRole("article", { name: "Film 1", exact: true });
  const heading = card.getByRole("heading");
  await heading.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 100,
    clientY: 300,
  });
  await heading.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 100,
    clientY: 200,
  });
  await expect(
    card.getByRole("button", { name: "J’aime Film 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await card
    .getByRole("button", { name: "J’aime Film 1", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Retirer J’aime pour Film 1" }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("l’ouverture de fiche est animée et le mouvement réduit est respecté", async ({
  page,
}) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page
    .getByRole("article", { name: "Film 1", exact: true })
    .getByRole("button", { name: "Détails", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  expect(await modal.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "detailDialogIn",
  );
  await expect(modal.getByText("123 min", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("article", { name: "Film 1", exact: true })
    .getByRole("button", { name: "Détails", exact: true })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
test("sur le web, les réglages ne prétendent pas programmer des notifications navigateur fermé", async ({
  page,
}) => {
  await setup(page, false);
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Réglages", exact: true })
      .getByText(
        "Cet horaire sera repris dans l’application Android après connexion au même compte.",
        { exact: false },
      ),
  ).toBeVisible();
});

test("double-tap tactile réel : À voir sans ouvrir de fiche ni marquer un favori", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const card = page.getByRole("article", { name: "Film 1", exact: true });
  await card.tap({ position: { x: 100, y: 100 } });
  await card.tap({ position: { x: 100, y: 100 } });
  await expect(
    card.getByRole("button", { name: "Retirer Film 1 de ma liste" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("cartes adaptées aux petits écrans et à une faible hauteur", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage))
      if (
        key.startsWith("luma-feed-") ||
        key.startsWith("luma-recommendation-pool")
      )
        localStorage.removeItem(key);
  });
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    await enter(page);
    const card = page.getByRole("article", { name: "Film 1", exact: true });
    const feed = await page.getByRole("feed").boundingBox(),
      bounds = await card.boundingBox();
    expect(bounds!.bottom ?? bounds!.y + bounds!.height).toBeLessThanOrEqual(
      feed!.y + feed!.height,
    );
    for (const b of await card.getByRole("button").all()) {
      const box = await b.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        bounds!.x + bounds!.width,
      );
    }
  }
});
test("une panne de pagination garde les cartes et peut être réessayée sans sauter la page", async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  const pages: number[] = [];
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const url = new URL(r.request().url()),
      n = Number(url.searchParams.get("page") || 1);
    pages.push(n);
    if (n === 2 && fail) return r.fulfill({ status: 503, json: {} });
    return r.fulfill({
      json: {
        results: Array.from({ length: 20 }, (_, i) =>
          raw((n - 1) * 20 + i + 1),
        ),
        total_pages: 3,
      },
    });
  });
  await enter(page);
  const feed = page.getByRole("feed");
  for (let i = 0; i < 28 && !pages.includes(2); i++) {
    const before = await feed.evaluate((el) => ({
      top: el.scrollTop,
      height: el.scrollHeight,
    }));
    await feed.press("PageDown");
    await expect
      .poll(
        async () =>
          pages.includes(2) ||
          (await feed.evaluate(
            (el, previous) =>
              el.scrollTop > previous.top + 1 ||
              el.scrollHeight > previous.height,
            before,
          )),
      )
      .toBe(true);
  }
  await expect(page.getByRole("alert")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Réessayer la suite" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pages.filter((n) => n === 2).length).toBeGreaterThan(2);
});

test("un grand geste de molette s’arrête à la carte suivante, le clavier revient à la précédente", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const feed = page.getByRole("feed");
  const step = await page
    .locator(".recommendation-row")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height + 16);
  const bounds = await feed.boundingBox();
  await page.mouse.move(bounds!.x + 100, bounds!.y + 200);
  await feed.evaluate((el) => {
    el.setAttribute("data-test-stopped", "no");
    el.addEventListener(
      "scrollend",
      () => el.setAttribute("data-test-stopped", "yes"),
      { once: true },
    );
  });
  await page.mouse.wheel(0, 2400);
  await expect(feed).toHaveAttribute("data-test-stopped", "yes");
  expect(
    Math.abs((await feed.evaluate((el) => el.scrollTop)) - step),
  ).toBeLessThan(2);
  await feed.focus();
  await page.keyboard.press("PageUp");
  await expect.poll(() => feed.evaluate((el) => el.scrollTop)).toBeLessThan(2);
});
test("un swipe tactile long s’arrête sur la première carte suivante, sans position intermédiaire", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const feed = page.getByRole("feed");
  const step = await page
    .locator(".recommendation-row")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height + 16);
  const client = await page.context().newCDPSession(page);
  await feed.evaluate((el) => {
    el.setAttribute("data-test-stopped", "no");
    el.addEventListener(
      "scrollend",
      () => el.setAttribute("data-test-stopped", "yes"),
      { once: true },
    );
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 700 }],
  });
  for (let y = 640; y >= 160; y -= 60) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(feed).toHaveAttribute("data-test-stopped", "yes");
  expect(
    Math.abs((await feed.evaluate((el) => el.scrollTop)) - step),
  ).toBeLessThan(2);
  await client.detach();
});

test("le fil tactile dépasse les 9 premières cartes et charge plusieurs pages sans blocage", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(page);
  const pages: number[] = [];
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const url = new URL(r.request().url());
    const n = Number(url.searchParams.get("page") || 1);
    pages.push(n);
    return r.fulfill({
      json: {
        results: Array.from({ length: 9 }, (_, i) => raw((n - 1) * 9 + i + 1)),
        total_pages: 6,
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const feed = page.getByRole("feed");
  const step = await page
    .locator(".recommendation-row")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height + 16);
  const client = await page.context().newCDPSession(page);
  const seenCards = new Set(["tmdb-movie-1"]);
  for (let i = 1; i <= 27; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 200, y: 700 }],
    });
    for (let y = 640; y >= 160; y -= 60) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 200, y }],
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Math.abs((await feed.evaluate((el) => el.scrollTop)) - step * i),
      )
      .toBeLessThan(2);
    await expect(page.locator(".feed-ambience")).toHaveAttribute(
      "data-moving",
      "false",
    );
    const title = await page
      .locator(".feed-ambience")
      .getAttribute("data-title");
    expect(seenCards.has(title!)).toBe(false);
    seenCards.add(title!);
  }
  expect(pages).toContain(4);
  expect(await page.locator(".recommendation-card").count()).toBeLessThan(10);
  await client.detach();
});

test("barres transparentes de même taille et halo conservé pendant le geste, puis fondu direct rapide après l’arrêt", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://api.themoviedb.org/3/**", (r) =>
    r.fulfill({
      json: {
        results: Array.from({ length: 20 }, (_, i) => ({
          ...raw(i + 1),
          backdrop_path: `/scene-${i + 1}.svg`,
        })),
        total_pages: 1,
      },
    }),
  );
  await page.route("https://image.tmdb.org/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="${r.request().url().includes("scene-1.svg") ? "#e9b91c" : "#c33b65"}"/></svg>`,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const header = page.locator(".topbar");
  const originalHeight = (await header.boundingBox())!.height;
  const nav = page.locator(".mobile-nav");
  const navHeight = (await nav.boundingBox())!.height;
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Film 1", exact: true }),
  ).toBeVisible();
  expect((await header.boundingBox())!.height).toBe(originalHeight);
  expect((await nav.boundingBox())!.height).toBe(navHeight);
  for (const bar of [header, nav]) {
    expect(
      await bar.evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
    expect(
      await bar.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
  }
  const glow = page.locator(".feed-ambience");
  await expect
    .poll(() => glow.evaluate((el) => el.style.getPropertyValue("--art-rgb")))
    .toBe("233 185 28");
  const firstButton = page
    .getByRole("article", { name: "Film 1", exact: true })
    .getByRole("button", { name: "Détails", exact: true });
  const firstColor = await firstButton.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await page.screenshot({ path: "tests/recommendations-ambient-dark.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(glow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const halo = page.locator(".feed-halo");
  const initialShadow = await halo.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  await page.evaluate(() => {
    const w = window as any;
    w.ambienceFrames = [];
    function sample() {
      const el = document.querySelector(".feed-ambience")!;
      w.ambienceFrames.push({
        opacity: Number(getComputedStyle(el).opacity),
        shadow: getComputedStyle(document.querySelector(".feed-halo")!)
          .boxShadow,
      });
      w.ambienceRaf = requestAnimationFrame(sample);
    }
    sample();
  });
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 700 }],
  });
  for (let y = 640; y >= 160; y -= 60) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await expect(glow).toHaveAttribute("data-moving", "true");
  await expect(glow).toHaveAttribute("data-artwork", "tmdb-movie-1");
  await expect(glow).toHaveCSS("opacity", "1");
  await expect(halo).toHaveCSS("box-shadow", initialShadow);
  await expect
    .poll(() => glow.evaluate((el) => el.style.getPropertyValue("--art-rgb")))
    .toBe("233 185 28");
  await expect(page.locator(".chrome-artwork")).toHaveCount(0);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(glow).toHaveAttribute("data-title", "tmdb-movie-2");
  await expect(glow).toHaveAttribute("data-moving", "false");
  await expect(glow).toHaveAttribute("data-artwork", "tmdb-movie-2");
  await expect
    .poll(() => glow.evaluate((el) => el.style.getPropertyValue("--art-rgb")))
    .toBe("195 59 101");
  await expect(halo).toHaveCSS(
    "box-shadow",
    "rgba(195, 59, 101, 0.6) 0px 0px 36px 16px",
  );
  await expect
    .poll(() => glow.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
  expect(
    await halo.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0.17s");
  const frames = await page.evaluate(() => {
    const w = window as any;
    cancelAnimationFrame(w.ambienceRaf);
    return w.ambienceFrames as { opacity: number; shadow: string }[];
  });
  expect(Math.min(...frames.map((frame) => frame.opacity))).toBe(1);
  expect(
    frames.some(
      (frame) =>
        frame.shadow !== initialShadow &&
        frame.shadow !== "rgba(195, 59, 101, 0.6) 0px 0px 36px 16px",
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("article", { name: "Film 2", exact: true })
      .getByRole("button", { name: "Détails", exact: true })
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(firstColor);
  await page.screenshot({ path: "tests/recommendations-ambient-next.png" });
  await page
    .getByRole("button", { name: "Passer en mode clair", exact: true })
    .click();
  await page.screenshot({ path: "tests/recommendations-ambient-light.png" });
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await expect(glow).toHaveCount(0);
  expect((await header.boundingBox())!.height).toBe(originalHeight);
  await client.detach();
});

test("Android : couleur native et halo symétrique, aucune affiche ou surface floutée dans les barres", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("vela-welcome-v1", "done");
    w.CapacitorCustomPlatform = { name: "android" };
    w.nativeArtworkRequests = [];
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#e9b91c"/><rect x="600" width="200" height="1200" fill="#009fe3"/></svg>';
    w.Capacitor = {
      PluginHeaders: [
        { name: "CapacitorHttp", methods: [{ name: "get", rtype: "promise" }] },
        {
          name: "SystemBars",
          methods: [{ name: "setStyle", rtype: "promise" }],
        },
        {
          name: "LumaAppearance",
          methods: [{ name: "setTheme", rtype: "promise" }],
        },
      ],
      nativePromise: async (plugin: string, _method: string, options: any) => {
        if (plugin !== "CapacitorHttp") return {};
        w.nativeArtworkRequests.push(options);
        return {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
          data: btoa(svg),
        };
      },
    };
  });
  await page.route("https://image.tmdb.org/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "https://unrelated.invalid" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#e9b91c"/><rect x="600" width="200" height="1200" fill="#009fe3"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const glow = page.locator(".feed-ambience");
  await expect
    .poll(() => glow.evaluate((el) => el.style.getPropertyValue("--art-rgb")))
    .toBe("233 185 28");
  const imageUrl = await page
    .getByRole("article", { name: "Film 1", exact: true })
    .locator(".recommendation-art img")
    .getAttribute("src");
  expect(
    await page.evaluate(() => (window as any).nativeArtworkRequests),
  ).toEqual([
    expect.objectContaining({ url: imageUrl, responseType: "arraybuffer" }),
  ]);
  const shadow = await page
    .locator(".feed-halo")
    .evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain("233, 185, 28");
  expect(shadow).toContain("0px 0px 36px 16px");
  expect(
    await glow.evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toBe("none");
  const card = await page
    .getByRole("article", { name: "Film 1", exact: true })
    .boundingBox();
  const halo = await page.locator(".feed-halo").boundingBox();
  expect(halo!.x).toBeCloseTo(card!.x, 0);
  expect(halo!.y).toBeCloseTo(card!.y, 0);
  expect(halo!.width).toBeCloseTo(card!.width, 0);
  expect(halo!.height).toBeCloseTo(card!.height, 0);
  await page.addStyleTag({
    content: ".MuiTouchRipple-root {display:none!important}",
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".chrome-artwork")).toHaveCount(0);
  const bars = [page.locator(".topbar"), page.locator(".mobile-nav")];
  for (const bar of bars) {
    await expect(bar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(bar).toHaveCSS("background-image", "none");
    await expect(bar).toHaveCSS("backdrop-filter", "none");
    await expect(bar).toHaveCSS("box-shadow", "none");
  }
  await expect(glow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // Other pages regain their existing surfaces; this change is scoped to the feed.
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await expect(page.locator("main")).not.toHaveClass("is-feed");
  for (const bar of bars) {
    expect(
      await bar.evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toContain("blur(");
    expect(
      await bar.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).not.toBe("rgba(0, 0, 0, 0)");
  }
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.getByRole("feed")).toBeVisible();
  for (const mode of ["dark", "light"] as const) {
    const currentMode = await page.locator("html").getAttribute("data-theme");
    if (currentMode !== mode)
      await page.locator(".header-actions button").first().click();
    for (const bar of bars) {
      await expect(bar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(bar).toHaveCSS("backdrop-filter", "none");
    }
  }
  const labels = await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button")
    .allTextContents();
  expect(labels).toEqual([
    "Découvrir",
    "Explorer",
    "Pour vous",
    "Collection",
    "Profil",
  ]);
  await page.screenshot({ path: "tests/recommendations-uniform-native.png" });
});

test("une image affichable mais illisible en CORS n’invente plus de halo bleu", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://image.tmdb.org/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "https://unrelated.invalid" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#e9b91c"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const image = page
    .getByRole("article", { name: "Film 1", exact: true })
    .locator(".recommendation-art img");
  await expect
    .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBe(800);
  const glow = page.locator(".feed-ambience");
  await expect(glow).toHaveCSS("opacity", "0");
  expect(
    await glow.evaluate((el) => el.style.getPropertyValue("--art-rgb")),
  ).toBe("128 128 128");
});

test("aucune carte de la journée ne revient après changement d’onglet, redémarrage ou reprise ; réactions conservées", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const seen = new Set(["tmdb-movie-1"]);
  let liked = "";
  for (let visit = 0; visit < 4; visit++) {
    if (visit < 2) {
      await page
        .getByRole("button", { name: "Collection", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pour vous", exact: true })
        .click();
    } else if (visit === 2) {
      await page.reload();
      await page
        .getByRole("button", { name: "Pour vous", exact: true })
        .click();
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    await expect
      .poll(() => page.locator(".feed-ambience").getAttribute("data-artwork"))
      .toMatch(/^tmdb-movie-/);
    const id = (await page
      .locator(".feed-ambience")
      .getAttribute("data-artwork"))!;
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    if (!visit) {
      liked = id;
      await page
        .getByRole("article", {
          name: `Film ${id.split("-").at(-1)}`,
          exact: true,
        })
        .getByRole("button", {
          name: `J’aime Film ${id.split("-").at(-1)}`,
          exact: true,
        })
        .click();
    }
    expect(await page.getByRole("feed").evaluate((el) => el.scrollTop)).toBe(0);
  }
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem("luma-library-v1") || "{}")[id],
    liked,
  );
  expect(saved.recommendationFeedback).toBe("like");
  expect(saved.favorite).toBe(true);
});

test("une première page entièrement consultée est exclue et les pages inédites sont chargées", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "luma-feed-recent-v1:local",
      JSON.stringify(
        Array.from({ length: 20 }, (_, i) => `tmdb-movie-${i + 1}`),
      ),
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-artwork",
    "tmdb-movie-21",
  );
  expect(calls.some((url) => url.includes("page=2"))).toBe(true);
});

test("l’épuisement du catalogue ne recycle rien ; les préchargements ne comptent pas comme affichages ; minuit ouvre une nouvelle journée", async ({
  page,
}) => {
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-11-05T12:00:00Z"));
  await page.route("https://api.themoviedb.org/3/**", (r) =>
    r.fulfill({
      json: {
        results: Array.from({ length: 9 }, (_, i) => raw(i + 1)),
        total_pages: 1,
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  const ids = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("luma-feed-seen-v2:"))
      .flatMap((k) => JSON.parse(localStorage.getItem(k)!).ids),
  );
  expect(ids).toEqual(["tmdb-movie-1"]);
  const feed = page.getByRole("feed");
  const stride = await page
    .locator(".recommendation-row")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height + 16);
  for (let i = 1; i < 9; i++) {
    const previous = await page
      .locator(".feed-ambience")
      .getAttribute("data-title");
    await feed.press("PageDown");
    await expect
      .poll(async () =>
        Math.abs((await feed.evaluate((el) => el.scrollTop)) - i * stride),
      )
      .toBeLessThan(2);
    await expect
      .poll(() => page.locator(".feed-ambience").getAttribute("data-title"))
      .not.toBe(previous);
    await expect(page.locator(".feed-ambience")).toHaveAttribute(
      "data-moving",
      "false",
    );
  }
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(localStorage)
            .filter((k) => k.startsWith("luma-feed-seen-v2:"))
            .flatMap((k) => JSON.parse(localStorage.getItem(k)!).ids).length,
      ),
    )
    .toBe(9);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(
    page.getByText("Aucun autre film inédit disponible pour aujourd’hui."),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00Z"));
  await page.reload();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-artwork",
    "tmdb-movie-1",
  );
});

test("les requêtes de voisinage couvrent quatre favoris et donnent immédiatement une place au nouveau", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  const ids = await page.evaluate(async () => {
    const { buildTasteProfile, getRecommendationChunk } =
      await import("/src/recommendations.ts");
    const library = Object.fromEntries(
      [1, 2, 3, 4].map((id) => [
        String(id),
        {
          title: {
            id: `tmdb-movie-${id}`,
            source: "tmdb",
            kind: "movie",
            name: id === 4 ? "Les Goonies" : `SF ${id}`,
            year: id === 4 ? "1985" : "2020",
            genres: id === 4 ? ["Aventure", "Familial"] : ["Science-fiction"],
            summary:
              id === 4
                ? "Des amis partent chercher un trésor."
                : "Un astronaute dans l’espace.",
            image: "",
          },
          watched: false,
          watchlist: false,
          favorite: true,
          rating: id === 4 ? 0 : 5,
          updated: `2026-11-0${id}T12:00:00Z`,
          watchedAt: "2026-11-05",
          episodes: [],
          review: "",
        },
      ]),
    );
    const profile = buildTasteProfile(library as any);
    const first = await getRecommendationChunk(
      profile,
      [],
      {},
      new AbortController().signal,
    );
    await getRecommendationChunk(
      profile,
      [],
      first.cursor,
      new AbortController().signal,
    );
    return profile.seeds.map((e) => e.title.id);
  });
  expect(ids).toHaveLength(4);
  expect(ids[0]).toBe("tmdb-movie-4");
  for (const id of [1, 2, 3, 4])
    expect(
      calls.some((url) => url.includes(`/movie/${id}/recommendations`)),
    ).toBe(true);
  expect(
    calls.some(
      (url) =>
        url.includes("with_genres=") &&
        url.includes("primary_release_date.gte=1980"),
    ),
  ).toBe(true);
});

test("parcours réel : liker Les Goonies dans Explorer ajoute une famille de recommandations à côté des favoris SF", async ({
  page,
}) => {
  const calls = await setup(page);
  const mk = (
    id: number,
    name: string,
    genres: number[],
    summary: string,
    year = "2020",
  ) => ({
    ...raw(id),
    title: name,
    original_title: name,
    genre_ids: genres,
    overview: summary,
    release_date: `${year}-01-01`,
  });
  const liked = [
    mk(
      1,
      "Who am I",
      [80, 53],
      "Un hacker et des pirates informatiques dans un réseau secret.",
      "2014",
    ),
    mk(
      2,
      "Projet dernière chance",
      [878, 12],
      "Un astronaute doit survivre dans l’espace pour sauver une planète.",
    ),
    mk(
      3,
      "Seul sur Mars",
      [878, 12],
      "Un astronaute isolé organise sa survie sur Mars dans l’espace.",
      "2015",
    ),
  ];
  const goonies = mk(
    4,
    "Les Goonies",
    [12, 10751],
    "Une bande d’amis enfants part à l’aventure pour retrouver un trésor.",
    "1985",
  );
  const space = Array.from({ length: 8 }, (_, i) =>
    mk(
      101 + i,
      `Mission spatiale ${i}`,
      [878, 12],
      i % 2 ? liked[1].overview : liked[2].overview,
    ),
  );
  const cyber = Array.from({ length: 4 }, (_, i) =>
    mk(201 + i, `Enquête cyber ${i}`, [80, 53], liked[0].overview),
  );
  const adventure = Array.from({ length: 4 }, (_, i) =>
    mk(
      401 + i,
      `La bande du trésor ${i}`,
      [12, 10751],
      "Une bande d’amis enfants cherche un trésor dans une aventure.",
      "1986",
    ),
  );
  const library = Object.fromEntries(
    liked.map((t, i) => [
      `tmdb-movie-${t.id}`,
      {
        title: {
          id: `tmdb-movie-${t.id}`,
          source: "tmdb",
          kind: "movie",
          name: t.title,
          year: t.release_date.slice(0, 4),
          image: "",
          genres: i ? ["Science-fiction", "Aventure"] : ["Crime", "Thriller"],
          genreIds: t.genre_ids,
          summary: t.overview,
        },
        watched: true,
        watchlist: false,
        favorite: true,
        rating: 5,
        review: "",
        episodes: [],
        watchedAt: "2026-11-05",
        updated: `2026-11-0${i + 1}T12:00:00Z`,
      },
    ]),
  );
  await page.addInitScript(
    (library) =>
      localStorage.setItem("luma-library-v1", JSON.stringify(library)),
    library,
  );
  await page.route("https://api.themoviedb.org/3/**", (r) => {
    const u = new URL(r.request().url());
    calls.push(u.pathname + u.search);
    if (u.pathname.endsWith("/movie/4"))
      return r.fulfill({
        json: {
          ...goonies,
          genres: [
            { id: 12, name: "Aventure" },
            { id: 10751, name: "Familial" },
          ],
          runtime: 114,
          videos: { results: [] },
          external_ids: {},
        },
      });
    if (u.pathname.includes("/search/movie"))
      return r.fulfill({ json: { results: [goonies], total_pages: 1 } });
    if (u.pathname.includes("/tv/"))
      return r.fulfill({ json: { results: [], total_pages: 1 } });
    let results = [...space, ...cyber];
    if (
      u.pathname.includes("/movie/4/recommendations") ||
      (u.pathname.includes("/discover/movie") && u.search.includes("10751"))
    )
      results = adventure;
    else if (u.pathname.includes("/movie/1/recommendations")) results = cyber;
    return r.fulfill({ json: { results, total_pages: 3 } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
  expect(calls.some((url) => url.includes("/movie/4/recommendations"))).toBe(
    false,
  );
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Rechercher dans le catalogue" })
    .fill("Les Goonies");
  await page.getByRole("button", { name: /Les Goonies/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Coup de cœur" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect
    .poll(() => calls.some((url) => url.includes("/movie/4/recommendations")))
    .toBe(true);
  const card = page.getByRole("article", {
    name: "La bande du trésor 0",
    exact: true,
  });
  await expect(card).toBeAttached();
  const position = await card.evaluate((el) => {
    const row = el.parentElement!;
    const y = new DOMMatrix(getComputedStyle(row).transform).m42;
    return y / (row.getBoundingClientRect().height + 16);
  });
  expect(position).toBeLessThan(3);
  await expect(card.getByText(/amitié|bande|aventure/).first()).toBeAttached();
});

test("sans catalogue réseau, le pool local est reclassé et les impressions restent exclues", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.route("https://api.themoviedb.org/3/**", (r) =>
    r.abort("internetdisconnected"),
  );
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Film 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Film 1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("article", { name: "Film 2", exact: true })
    .getByRole("button", { name: "J’aime Film 2", exact: true })
    .click();
  await expect(
    page
      .getByRole("article", { name: "Film 2", exact: true })
      .getByRole("button", { name: "Retirer J’aime pour Film 2" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("les anciennes sources d’un goût abandonné ne gardent pas artificiellement le flux ouvert", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  const hasMore = await page.evaluate(async () => {
    const { buildTasteProfile, getRecommendationChunk } =
      await import("/src/recommendations.ts");
    return (
      await getRecommendationChunk(
        buildTasteProfile({}),
        [],
        {
          bootstrap: null,
          "discover:all": null,
          "discover:878": 2,
          "explore:0": null,
          "explore:1": null,
        },
        new AbortController().signal,
      )
    ).hasMore;
  });
  expect(hasMore).toBe(false);
});

test("le classement du pool local s’exécute dans un worker sans bloquer les minuteries de l’interface", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  const workerStarted = page.waitForEvent("worker");
  const result = await page.evaluate(async () => {
    const { LocalRanker } = await import("/src/local-ranker.ts");
    const { buildTasteProfile } = await import("/src/recommendations.ts");
    const genres = ["Science-fiction", "Aventure", "Thriller", "Familial"];
    const summaries = [
      "Un astronaute survit dans l’espace.",
      "Une bande d’amis cherche un trésor.",
      "Un hacker enquête sur un réseau secret.",
      "Une famille part en voyage.",
    ];
    const title = (i: number) => ({
      id: `tmdb-movie-${i}`,
      kind: "movie" as const,
      name: `Film ${i}`,
      genres: [genres[i % 4]],
      summary: summaries[i % 4],
      image: "",
      year: "2020",
    });
    const library = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [
        String(i),
        {
          title: title(10000 + i),
          favorite: true,
          watched: true,
          watchlist: false,
          rating: 4,
          review: "Texte privé hors du modèle",
          updated: "2026-11-05T12:00:00Z",
          watchedAt: "2026-11-05",
          episodes: [],
        },
      ]),
    );
    const profile = buildTasteProfile(library),
      ranker = new LocalRanker();
    let beats = 0;
    const timer = setInterval(() => beats++, 10);
    const suggestions = await ranker.rank(
      profile,
      Array.from({ length: 600 }, (_, i) => ({
        title: title(i + 1),
        seeds: [],
      })),
      [],
    );
    clearInterval(timer);
    ranker.dispose();
    return {
      beats,
      count: suggestions.length,
      finite: suggestions.every((x) => Number.isFinite(x.score)),
    };
  });
  const worker = await workerStarted;
  expect(worker.url()).toContain("recommendation-worker");
  expect(result.count).toBe(32);
  expect(result.finite).toBe(true);
  expect(result.beats).toBeGreaterThan(0);
});

test("un nouveau calcul annule l’ancien worker sans publier un classement périmé", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { LocalRanker } = await import("/src/local-ranker.ts");
    const { buildTasteProfile } = await import("/src/recommendations.ts");
    const ranker = new LocalRanker(),
      profile = buildTasteProfile({}),
      c = new AbortController();
    const candidate = (id: number) => ({
      title: {
        id: `tmdb-movie-${id}`,
        kind: "movie" as const,
        name: `Titre ${id}`,
        genres: [],
        summary: "Une aventure.",
        image: "",
        year: "2020",
      },
      seeds: [],
    });
    const old = ranker.rank(profile, [candidate(1)], [], c.signal).then(
      () => "incorrect",
      (error) => error.name,
    );
    c.abort();
    const current = await ranker.rank(profile, [candidate(2)], []);
    const cancelled = await old;
    ranker.dispose();
    return { cancelled, ids: current.map((x) => x.title.id) };
  });
  expect(result).toEqual({ cancelled: "AbortError", ids: ["tmdb-movie-2"] });
});

async function skippedIds(page: Page) {
  return page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("vela-implicit-skips-v1:local") || "[]",
    ).map((s: any) => s.title.id),
  );
}
async function forwardCard(page: Page) {
  const feed = page.getByRole("feed"),
    old = await page.locator(".feed-ambience").getAttribute("data-title");
  await feed.focus();
  await page.keyboard.press("PageDown");
  await expect(page.locator(".feed-ambience")).not.toHaveAttribute(
    "data-title",
    old!,
  );
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-moving",
    "false",
  );
  await expect(feed).toHaveAttribute("aria-busy", "false");
}
test("skipper apprend localement sans modifier les notes, sans appel catalogue et avec reprise après redémarrage", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const Native = window.Worker;
    (window as any).implicitJobs = 0;
    window.Worker = class extends Native {
      postMessage(message: any, options?: any) {
        if (message?.profile?.implicit?.length) (window as any).implicitJobs++;
        super.postMessage(message, options);
      }
    } as typeof Worker;
  });
  await enter(page);
  await expect(page.getByRole("feed")).toHaveAttribute("aria-busy", "false");
  const before = calls.length;
  await page.waitForTimeout(600);
  await forwardCard(page);
  await expect.poll(() => skippedIds(page)).toEqual(["tmdb-movie-1"]);
  await expect
    .poll(() => page.evaluate(() => (window as any).implicitJobs))
    .toBeGreaterThan(0);
  expect(calls.length).toBe(before);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("luma-library-v1") || "{}")[
          "tmdb-movie-1"
        ],
    ),
  ).toBeUndefined();
  await page.reload();
  await page.getByRole("button", { name: "Pour vous", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).implicitJobs))
    .toBeGreaterThan(0);
  expect(await skippedIds(page)).toEqual(["tmdb-movie-1"]);
  await expect(page.locator(".feed-ambience")).not.toHaveAttribute(
    "data-title",
    "tmdb-movie-1",
  );
});
test("détails, likes, liste, lecture longue et retour arrière ne deviennent pas des refus implicites", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  let id = await page.locator(".feed-ambience").getAttribute("data-title");
  await page
    .locator(`[data-title-id="${id}"]`)
    .getByRole("button", { name: "Détails", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await page.waitForTimeout(500);
  await forwardCard(page);
  expect(await skippedIds(page)).toEqual([]);
  id = await page.locator(".feed-ambience").getAttribute("data-title");
  await page
    .locator(`[data-title-id="${id}"]`)
    .getByRole("button", { name: /^J’aime / })
    .click();
  await page.waitForTimeout(500);
  await forwardCard(page);
  expect(await skippedIds(page)).toEqual([]);
  id = await page.locator(".feed-ambience").getAttribute("data-title");
  await page
    .locator(`[data-title-id="${id}"]`)
    .getByRole("button", { name: /^Ajouter .* à ma liste$/ })
    .click();
  await page.waitForTimeout(500);
  await forwardCard(page);
  expect(await skippedIds(page)).toEqual([]);
  await page.waitForTimeout(3200);
  await forwardCard(page);
  expect(await skippedIds(page)).toEqual([]);
  const feed = page.getByRole("feed");
  await feed.focus();
  await page.keyboard.press("PageUp");
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-moving",
    "false",
  );
  await page.waitForTimeout(500);
  await forwardCard(page);
  expect(await skippedIds(page)).toEqual([]);
});
test("un vrai swipe tactile ne compte que la carte quittée, jamais les cartes préchargées", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await expect(page.getByRole("feed")).toHaveAttribute("aria-busy", "false");
  expect(await skippedIds(page)).toEqual([]);
  await page.waitForTimeout(600);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 700 }],
  });
  for (let y = 640; y >= 160; y -= 60) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 200, y }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".feed-ambience")).toHaveAttribute(
    "data-title",
    "tmdb-movie-2",
  );
  await expect.poll(() => skippedIds(page)).toEqual(["tmdb-movie-1"]);
  await client.detach();
  await page.getByRole("button", { name: "Collection", exact: true }).click();
  expect(await skippedIds(page)).toEqual(["tmdb-movie-1"]);
});

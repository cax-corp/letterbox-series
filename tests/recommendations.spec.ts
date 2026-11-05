import { test, expect } from "@playwright/test";
import {
  buildTasteProfile,
  rankRecommendations,
  type Candidate,
} from "../src/recommendations";
import type { Title } from "../src/catalog";
import type { Entry } from "../src/store";
function title(
  id: number,
  name: string,
  genre: string,
  extra: Partial<Title> = {},
): Title {
  return {
    id: `tmdb-movie-${id}`,
    source: "tmdb",
    kind: "movie",
    name,
    year: "2020",
    image: "",
    summary: "Une histoire.",
    genres: [genre],
    score: 8,
    ...extra,
  };
}
function entry(t: Title, extra: Partial<Entry> = {}): Entry {
  return {
    title: t,
    watchlist: false,
    watched: true,
    rating: 0,
    review: "",
    favorite: false,
    updated: "2026-11-05T12:00:00Z",
    watchedAt: "2026-11-05",
    episodes: [],
    ...extra,
  };
}
const candidates = (...titles: Title[]): Candidate[] =>
  titles.map((title) => ({ title, seeds: [] }));
test("les bonnes notes privilégient un genre, les mauvaises le font descendre, les films vus sont exclus", () => {
  const loved = entry(title(100, "Étoiles", "Science-fiction"), {
      rating: 5,
      favorite: true,
    }),
    bad = entry(title(200, "La peur", "Horreur"), { rating: 1 });
  const profile = buildTasteProfile({
    [loved.title.id]: loved,
    [bad.title.id]: bad,
  });
  const ranked = rankRecommendations(
    profile,
    candidates(
      title(1, "Un voyage", "Science-fiction", { score: 7 }),
      title(2, "Autre frisson", "Horreur", { score: 10 }),
      title(3, "Une rencontre", "Romance"),
      loved.title,
      bad.title,
    ),
  );
  expect(ranked[0].title.name).toBe("Un voyage");
  expect(
    ranked.findIndex((x) => x.title.name === "Autre frisson"),
  ).toBeGreaterThan(ranked.findIndex((x) => x.title.name === "Une rencontre"));
  expect(
    ranked.some((x) => [loved.title.id, bad.title.id].includes(x.title.id)),
  ).toBe(false);
  expect(ranked[0].reason).toContain("science-fiction");
});
test("un visionnage sans note ne devient pas un favori ; une mauvaise note domine un favori contradictoire", () => {
  const seen = entry(title(10, "Un documentaire", "Documentaire")),
    contradictory = entry(title(11, "Un mauvais souvenir", "Horreur"), {
      favorite: true,
      rating: 1,
    });
  const profile = buildTasteProfile({ a: seen, b: contradictory });
  expect(profile.seeds).toHaveLength(0);
  expect(profile.positiveCount).toBe(0);
  const ranked = rankRecommendations(
    profile,
    candidates(title(12, "Une enquête", "Documentaire")),
  );
  expect(ranked[0].reason).not.toContain("aimé");
  const positive = buildTasteProfile({ a: { ...seen, rating: 4.5 } });
  expect(positive.seeds[0].title.id).toBe(seen.title.id);
  expect(
    rankRecommendations(
      positive,
      candidates(title(12, "Une enquête", "Documentaire")),
    )[0].reason,
  ).toContain("goût");
});
test("les séries aimées influencent les genres de films, sans devenir des graines de films", () => {
  const tv = entry(
    title(20, "Une série de SF", "Sci-Fi & Fantasy", {
      id: "tmdb-series-20",
      kind: "series",
      genreIds: [10765],
    }),
    { rating: 5 },
  );
  const profile = buildTasteProfile({ tv });
  expect(profile.seeds).toHaveLength(0);
  expect(profile.preferredGenres).toEqual(expect.arrayContaining([878, 14]));
  expect(
    rankRecommendations(
      profile,
      candidates(
        title(1, "Fantastique", "Fantastique"),
        title(2, "Romantique", "Romance"),
      ),
    )[0].title.name,
  ).toBe("Fantastique");
});
test("anciens fournisseurs : exclusion des doublons vus, conservation des remakes et aucun rapprochement par réalisateur", () => {
  const old = entry(
    title(10, "Interstellar", "Science-fiction", {
      id: "movie-777",
      source: "itunes",
      year: "2014",
      original: "Christopher Nolan",
    }),
  );
  const profile = buildTasteProfile({ old });
  const ranked = rankRecommendations(
    profile,
    candidates(
      title(10, "Interstellar", "Science-fiction", { year: "2014" }),
      title(11, "Interstellar", "Science-fiction", { year: "2025" }),
      title(12, "Christopher Nolan", "Documentaire"),
      title(13, "Éclats", "Drame"),
      title(14, "Eclats", "Drame"),
    ),
  );
  expect(ranked.some((x) => x.title.id === "tmdb-movie-10")).toBe(false);
  expect(ranked.some((x) => x.title.id === "tmdb-movie-11")).toBe(true);
  expect(ranked.some((x) => x.title.name === "Christopher Nolan")).toBe(true);
  expect(
    ranked.filter((x) => ["Éclats", "Eclats"].includes(x.title.name)),
  ).toHaveLength(1);
});
test("la raison liée à un favori exige une relation TMDB réelle et ne revendique pas une note prédite", () => {
  const favorite = entry(title(100, "Mon favori", "Drame"), {
    favorite: true,
    rating: 0,
  });
  const profile = buildTasteProfile({ favorite });
  const result = rankRecommendations(profile, [
    {
      title: title(1, "Voisin", "Drame"),
      seeds: [{ id: favorite.title.id, name: "Mon favori", rank: 0 }],
    },
    { title: title(2, "Sans relation", "Drame"), seeds: [] },
  ]);
  expect(result.find((x) => x.title.name === "Voisin")?.reason).toBe(
    "Parce que vous avez aimé « Mon favori »",
  );
  expect(
    result.find((x) => x.title.name === "Sans relation")?.reason,
  ).not.toContain("Mon favori");
  expect(result.every((x) => !x.reason.includes("%"))).toBe(true);
});
test("les réactions explicites influencent les goûts sans modifier les notes", () => {
  const t = title(7, "Un film", "Science-fiction");
  const original = entry(t, {
    rating: 1,
    favorite: true,
    recommendationFeedback: "like",
  });
  const liked = buildTasteProfile({ original });
  expect(liked.positiveCount).toBe(1);
  expect(original.rating).toBe(1);
  const rejected = buildTasteProfile({
    original: { ...original, rating: 5, recommendationFeedback: "dislike" },
  });
  expect(rejected.seeds).toHaveLength(0);
  expect(rankRecommendations(rejected, candidates(t))).toHaveLength(0);
});

test("Who am I, Projet dernière chance et Seul sur Mars n’empêchent pas Les Goonies d’influencer le modèle", () => {
  const hacking = entry(
    title(100, "Who am I", "Thriller", {
      year: "2014",
      summary:
        "Un hacker et un groupe de pirates informatiques sur un réseau secret.",
    }),
    { favorite: true, rating: 5, updated: "2026-11-01T12:00:00Z" },
  );
  const space1 = entry(
    title(200, "Projet dernière chance", "Science-fiction", {
      summary:
        "Un astronaute dans l’espace doit survivre et sauver une planète.",
      genreIds: [878, 12],
    }),
    { favorite: true, rating: 5, updated: "2026-11-02T12:00:00Z" },
  );
  const space2 = entry(
    title(300, "Seul sur Mars", "Science-fiction", {
      year: "2015",
      summary:
        "Un astronaute isolé sur Mars lutte pour sa survie dans l’espace.",
      genreIds: [878, 12],
    }),
    { favorite: true, rating: 5, updated: "2026-11-03T12:00:00Z" },
  );
  const goonies = entry(
    title(400, "Les Goonies", "Aventure", {
      year: "1985",
      genreIds: [12, 10751],
      summary:
        "Une bande d’amis enfants part à l’aventure à la recherche d’un trésor.",
    }),
    {
      watched: false,
      favorite: true,
      recommendationFeedback: "like",
      updated: "2026-11-05T13:00:00Z",
    },
  );
  const pool = candidates(
    title(1, "Un équipage", "Science-fiction", {
      summary: space1.title.summary,
    }),
    title(2, "Autre astronaute", "Science-fiction", {
      summary: space2.title.summary,
    }),
    title(3, "Encore une planète", "Science-fiction", {
      summary: space1.title.summary,
    }),
    title(4, "La carte du trésor", "Aventure", {
      year: "1986",
      genreIds: [12, 10751],
      summary:
        "Une bande d’enfants et leurs amis cherchent un trésor dans une aventure.",
    }),
    title(5, "Cyber mystère", "Thriller", {
      summary: "Un hacker enquête sur un réseau informatique secret.",
    }),
  );
  const before = buildTasteProfile({ hacking, space1, space2 }),
    after = buildTasteProfile({ hacking, space1, space2, goonies });
  expect(after.seeds).toHaveLength(4);
  expect(after.seeds[0].title.name).toBe("Les Goonies");
  expect(after.fetchKey).not.toBe(before.fetchKey);
  const a = rankRecommendations(before, pool),
    b = rankRecommendations(after, pool);
  expect(b.findIndex((x) => x.title.id === "tmdb-movie-4")).toBeLessThan(
    a.findIndex((x) => x.title.id === "tmdb-movie-4"),
  );
  expect(b.slice(0, 3).some((x) => x.title.id === "tmdb-movie-4")).toBe(true);
  expect(b.find((x) => x.title.id === "tmdb-movie-4")!.reason).toMatch(
    /amitié|bande|aventure/,
  );
  expect(b.every((x) => !x.reason.startsWith("Parce que vous avez aimé"))).toBe(
    true,
  );
});

test("les synopsis distinguent deux films du même genre et un refus inverse leur classement", () => {
  const liked = entry(
    title(100, "Orbital", "Science-fiction", {
      summary:
        "Un astronaute isolé dans l’espace organise sa survie et son retour sur une planète.",
    }),
    { favorite: true },
  );
  const survival = title(1, "Retour impossible", "Science-fiction", {
    summary: liked.title.summary,
  });
  const tech = title(2, "Réseau noir", "Science-fiction", {
    summary: "Un hacker pirate un réseau informatique pour déjouer un complot.",
  });
  const p = buildTasteProfile({ liked });
  const result = rankRecommendations(p, candidates(tech, survival));
  expect(result[0].title.id).toBe(survival.id);
  const rejected = entry(
    { ...survival, id: "tmdb-movie-102", name: "Autre mission" },
    { watched: false, recommendationFeedback: "dislike" },
  );
  const changed = rankRecommendations(
    buildTasteProfile({ liked, rejected }),
    candidates(tech, survival),
  );
  expect(changed.find((x) => x.title.id === survival.id)!.score).toBeLessThan(
    result.find((x) => x.title.id === survival.id)!.score - 1,
  );
});

test("le profil utilise tous les favoris et change même si un nouveau favori partage les genres existants", () => {
  const library = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [
      String(i),
      entry(title(100 + i, `Favori ${i}`, "Science-fiction"), {
        favorite: true,
        updated: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
      }),
    ]),
  );
  const before = buildTasteProfile(library);
  const next = entry(
    title(999, "Un autre regard", "Science-fiction", {
      summary: "Un hacker dans un réseau informatique.",
    }),
    { favorite: true },
  );
  const after = buildTasteProfile({ ...library, next });
  expect(after.seeds).toHaveLength(31);
  expect(after.fetchKey).not.toBe(before.fetchKey);
});

test("modifier une critique ne rajeunit pas une ancienne préférence", () => {
  const old = entry(title(100, "Ancien favori", "Science-fiction"), {
    favorite: true,
    updated: "2026-11-05T12:00:00Z",
    preferenceUpdated: "2025-01-01T12:00:00Z",
  });
  const recent = entry(title(200, "Favori récent", "Aventure"), {
    favorite: true,
    updated: "2026-11-04T12:00:00Z",
  });
  const before = buildTasteProfile({ old, recent });
  const after = buildTasteProfile({
    old: { ...old, review: "Texte modifié", updated: "2026-11-05T13:00:00Z" },
    recent,
  });
  expect(after.seeds[0].title.id).toBe(recent.title.id);
  expect(after.fetchKey).toBe(before.fetchKey);
  expect(after.weights.get(old.title.id)).toBe(
    before.weights.get(old.title.id),
  );
});

test("le moteur traite un pool local de 600 titres et 200 préférences avec des scores finis", () => {
  const genres = ["Science-fiction", "Aventure", "Thriller", "Familial"];
  const summaries = [
    "Un astronaute survit dans l’espace.",
    "Une bande d’amis cherche un trésor.",
    "Un hacker enquête sur un réseau secret.",
    "Une famille part pour un voyage.",
  ];
  const library = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [
      String(i),
      entry(
        title(10000 + i, `Favori ${i}`, genres[i % 4], {
          summary: summaries[i % 4],
        }),
        { favorite: i % 5 !== 0, rating: i % 5 === 0 ? 1 : 4 },
      ),
    ]),
  );
  const pool = candidates(
    ...Array.from({ length: 600 }, (_, i) =>
      title(i + 1, `Candidat ${i}`, genres[i % 4], {
        summary: summaries[i % 4],
      }),
    ),
  );
  const start = performance.now();
  const result = rankRecommendations(buildTasteProfile(library), pool);
  test.info().annotations.push({
    type: "ranking-time",
    description: `${Math.round(performance.now() - start)} ms pour 600 candidats / 200 préférences sur le processeur de test`,
  });
  const profile = buildTasteProfile(library),
    partialStart = performance.now();
  const partial = rankRecommendations(profile, pool, [], 32);
  test
    .info()
    .annotations.push({
      type: "queue-time",
      description: `${Math.round(performance.now() - partialStart)} ms pour reclasser le pool et produire les 32 prochaines propositions`,
    });
  expect(partial).toEqual(result.slice(0, 32));
  expect(result).toHaveLength(600);
  expect(new Set(result.map((x) => x.title.id)).size).toBe(600);
  expect(result.every((x) => Number.isFinite(x.score))).toBe(true);
});

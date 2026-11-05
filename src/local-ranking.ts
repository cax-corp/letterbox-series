import type { Title } from "./catalog";
import type { TasteProfile, Candidate, Suggestion } from "./recommendations";
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const stop = new Set(
  `une des les dans avec pour sans sur sous aux est sont qui que quoi par pas plus ses leur leurs apres avant entre comme mais nous vous votre vos notre nos cette ces cet son elle ils elles il un du de le la et a au en se ce ne the of and to for with from his her their this that into who film films serie series histoire histoires connu monde vient nouveau nouvelle doit fait vie`.split(
    " ",
  ),
);
const concepts: [string, string, string[]][] = [
  [
    "space",
    "les récits d’exploration spatiale",
    [
      "espace",
      "spatial",
      "spatiale",
      "astronaut",
      "astronaute",
      "cosmos",
      "cosmique",
      "mars",
      "planete",
      "galaxie",
      "space",
      "planet",
    ],
  ],
  [
    "survival",
    "les histoires de survie",
    [
      "survie",
      "survivre",
      "survivant",
      "survival",
      "survive",
      "rescue",
      "secours",
      "naufrage",
      "isole",
      "isolation",
    ],
  ],
  [
    "hacking",
    "les intrigues de piratage et de technologie",
    [
      "piratage",
      "pirate",
      "informatique",
      "hacker",
      "hackers",
      "hacking",
      "cyber",
      "reseau",
      "numerique",
      "computer",
    ],
  ],
  [
    "friendship",
    "l’amitié et l’esprit de bande",
    [
      "amis",
      "ami",
      "amitie",
      "bande",
      "friend",
      "friends",
      "friendship",
      "camarades",
      "enfants",
      "adolescents",
    ],
  ],
  [
    "quest",
    "les aventures et les quêtes",
    [
      "tresor",
      "treasure",
      "quete",
      "aventure",
      "adventure",
      "expedition",
      "exploration",
      "explorer",
      "voyage",
      "journey",
    ],
  ],
  [
    "mystery",
    "les enquêtes et les mystères",
    [
      "mystere",
      "mystery",
      "enquete",
      "investigation",
      "detective",
      "secret",
      "secrets",
      "complot",
      "conspiracy",
    ],
  ],
  [
    "family",
    "les liens familiaux",
    [
      "famille",
      "family",
      "familial",
      "parent",
      "parents",
      "frere",
      "soeur",
      "siblings",
      "pere",
      "mere",
    ],
  ],
  [
    "romance",
    "les histoires d’amour",
    [
      "amour",
      "amoureux",
      "amoureuse",
      "romance",
      "love",
      "couple",
      "rencontre",
    ],
  ],
  [
    "fear",
    "le suspense et les récits inquiétants",
    [
      "horreur",
      "horror",
      "terreur",
      "tueur",
      "killer",
      "hante",
      "haunted",
      "cauchemar",
      "nightmare",
    ],
  ],
  [
    "fantasy",
    "les mondes imaginaires",
    [
      "magie",
      "magic",
      "magique",
      "dragon",
      "fantastique",
      "fantasy",
      "sorcier",
      "sorciere",
      "creature",
    ],
  ],
];
const stem = (word: string) =>
  word.length > 4 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;
const words = (t: Title) =>
  normalize(`${t.name} ${t.summary}`)
    .match(/[a-z]{3,}/g)
    ?.map(stem)
    .filter((word) => !stop.has(word)) || [];
type Vector = Map<string, number>;
function cosine(a: Vector, b: Vector) {
  let sum = 0;
  for (const [key, value] of a) sum += value * (b.get(key) || 0);
  return sum;
}
function unit(vector: Vector) {
  const norm = Math.hypot(...vector.values()) || 1;
  return new Map([...vector].map(([k, v]) => [k, v / norm]));
}
export function rankLocally(
  profile: TasteProfile,
  pool: Candidate[],
  genres: (t: Title) => number[],
  genreNames: Record<number, string>,
  previous: Title[] = [],
  limit = Infinity,
): Suggestion[] {
  const docs = [
    ...profile.entries.map((e) => e.title),
    ...pool.map((c) => c.title),
  ];
  const tokenCache = new Map<Title, string[]>();
  const vectorCache = new Map<Title, Vector>();
  const tokensFor = (title: Title) => {
    let tokens = tokenCache.get(title);
    if (!tokens) {
      tokens = words(title);
      tokenCache.set(title, tokens);
    }
    return tokens;
  };
  const frequency = new Map<string, number>();
  for (const t of docs)
    for (const word of new Set(tokensFor(t)))
      frequency.set(word, (frequency.get(word) || 0) + 1);
  const vector = (t: Title): Vector => {
    const cached = vectorCache.get(t);
    if (cached) return cached;
    const v = new Map<string, number>();
    const ids = genres(t);
    for (const id of ids) v.set(`g:${id}`, 2 / Math.sqrt(ids.length));
    const tokens = tokensFor(t),
      unique = new Set(tokens);
    const counts = new Map<string, number>();
    for (const word of tokens) counts.set(word, (counts.get(word) || 0) + 1);
    for (const word of unique) {
      const df = frequency.get(word) || 1;
      if (df / Math.max(1, docs.length) > 0.8) continue;
      v.set(
        `w:${word}`,
        0.45 *
          (1 + Math.log(counts.get(word) || 1)) *
          (1 + Math.log((docs.length + 1) / (df + 1))),
      );
    }
    for (const [id, , terms] of concepts)
      if (terms.some((word) => unique.has(stem(word)))) v.set(`c:${id}`, 1.8);
    const result = unit(v);
    vectorCache.set(t, result);
    return result;
  };
  const examples = profile.entries.map((e) => ({
    entry: e,
    v: vector(e.title),
    weight: profile.weights.get(e.title.id) || 0,
  }));
  const positive = examples.filter((e) => e.weight > 1),
    negative = examples.filter((e) => e.weight < 0);
  // Similar favourites form one taste family, so three space films do not claim three diversity slots.
  const clusters: typeof positive = [],
    bucketOf = new Map<string, string>();
  for (const example of positive) {
    const ids = new Set(genres(example.entry.title));
    const cluster = clusters.find((other) => {
      const otherIds = new Set(genres(other.entry.title));
      const intersection = [...ids].filter((id) => otherIds.has(id)).length;
      const jaccard =
        intersection / Math.max(1, new Set([...ids, ...otherIds]).size);
      return Math.max(cosine(example.v, other.v), 0.75 * jaccard) >= 0.58;
    });
    if (!cluster) clusters.push(example);
    bucketOf.set(
      example.entry.title.id,
      cluster?.entry.title.id || example.entry.title.id,
    );
  }
  const implicit = (profile.implicit || []).map((s) => ({
    v: vector(s.title),
    strength: Math.max(0, Math.min(0.14, s.strength)),
  }));
  const maxGenre = Math.max(1, ...[...profile.genres.values()].map(Math.abs));
  const result = pool.map((candidate) => {
    const { title, seeds } = candidate,
      v = vector(title),
      ids = genres(title);
    let best: ((typeof positive)[number] & { similarity: number }) | undefined;
    const top = [0, 0, 0];
    for (const example of positive) {
      const similarity =
        cosine(v, example.v) * (0.75 + 0.25 * Math.min(1, example.weight / 9));
      if (!best || similarity > best.similarity)
        best = { ...example, similarity };
      if (similarity > top[0]) {
        top[2] = top[1];
        top[1] = top[0];
        top[0] = similarity;
      } else if (similarity > top[1]) {
        top[2] = top[1];
        top[1] = similarity;
      } else if (similarity > top[2]) top[2] = similarity;
    }
    const content = best?.similarity || 0;
    const average =
      (top[0] + top[1] + top[2]) / Math.max(1, Math.min(3, positive.length));
    const avoidance = Math.max(
      0,
      ...negative.map(
        (e) => cosine(v, e.v) * Math.min(1, Math.abs(e.weight) / 5),
      ),
    );
    const genreAffinity =
      ids.reduce((s, id) => s + (profile.genres.get(id) || 0) / maxGenre, 0) /
      Math.max(1, ids.length);
    const links = seeds.filter((s) => (profile.weights.get(s.id) || 0) > 1);
    const related =
      Math.min(
        1,
        Math.log1p(
          links.reduce(
            (s, link) =>
              s +
              Math.min(9, profile.weights.get(link.id) || 0) /
                9 /
                (1 + link.rank / 12),
            0,
          ),
        ),
      ) * 0.8;
    let pair = 0;
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++)
        pair = Math.max(
          pair,
          profile.pairs.get([ids[a], ids[b]].sort((a, b) => a - b).join(":")) ||
            0,
        );
    pair = Math.tanh(pair / 6) * 0.5;
    const year = Number(title.year),
      era = year
        ? Math.max(
            0,
            ...positive.map((e) =>
              Number(e.entry.title.year)
                ? Math.exp(-Math.abs(Number(e.entry.title.year) - year) / 18)
                : 0,
            ),
          ) * 0.35
        : 0;
    const votes = Number.isFinite(title.voteCount)
        ? Math.max(0, title.voteCount!)
        : 100,
      quality = title.score
        ? Math.max(
            -0.3,
            Math.min(
              0.5,
              ((title.score * votes + 650) / (votes + 100) - 6.5) / 4,
            ),
          )
        : 0;
    // Weak, bounded evidence stays separate from explicit dislikes and genre normalization.
    const skipPenalty = Math.min(
      0.7,
      implicit.reduce(
        (sum, s) => sum + Math.max(0, cosine(v, s.v)) ** 3 * s.strength,
        0,
      ),
    );
    const score =
      content * 3.5 +
      average * 0.65 +
      genreAffinity * 1.6 +
      pair +
      era +
      related +
      quality -
      avoidance * 3.8 -
      skipPenalty;
    const concept = concepts.find(
      ([id]) => v.has(`c:${id}`) && best?.v.has(`c:${id}`),
    );
    const liked = ids
      .filter((id) => (profile.likedGenres.get(id) || 0) > 0)
      .sort(
        (a, b) =>
          (profile.likedGenres.get(b) || 0) - (profile.likedGenres.get(a) || 0),
      );
    const reason =
      profile.positiveCount === 1 && links.length
        ? `Parce que vous avez aimé « ${links[0].name} »`
        : concept
          ? `Votre goût pour ${concept[1]}`
          : liked.length > 1
            ? `Un croisement de ${genreNames[liked[0]]} et de ${genreNames[liked[1]]}`
            : liked.length
              ? `Votre goût pour ${genreNames[liked[0]]}`
              : links.length > 1
                ? "Au croisement de plusieurs de vos films appréciés"
                : profile.positiveCount
                  ? "Pour élargir vos horizons"
                  : "Une découverte pour commencer";
    return {
      title,
      reason,
      score,
      v,
      bucket: bucketOf.get(best?.entry.title.id || "") || "discovery",
    };
  });
  const remaining = result.sort(
    (a, b) =>
      b.score - a.score ||
      a.title.id.localeCompare(b.title.id, undefined, { numeric: true }),
  );
  const selected: typeof result = [];
  const trail = previous.slice(-5).map((title) => {
    const v = vector(title);
    const closest = positive
      .map((e) => ({ id: e.entry.title.id, similarity: cosine(v, e.v) }))
      .sort((a, b) => b.similarity - a.similarity)[0]?.id;
    return { v, bucket: bucketOf.get(closest || "") || "discovery" };
  });
  while (remaining.length && selected.length < limit) {
    let best = 0,
      bestScore = -Infinity;
    const recent = [...trail, ...selected].slice(-4);
    for (let i = 0; i < Math.min(remaining.length, 240); i++) {
      const item = remaining[i];
      const similarity = Math.max(
        0,
        ...recent.map((old) => cosine(item.v, old.v)),
      );
      const repetition = recent.filter(
        (old) => old.bucket === item.bucket,
      ).length;
      const adjusted = item.score - 0.85 * similarity - 0.65 * repetition;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = i;
      }
    }
    selected.push(remaining.splice(best, 1)[0]);
  }
  return selected.map(({ title, reason, score }) => ({ title, reason, score }));
}

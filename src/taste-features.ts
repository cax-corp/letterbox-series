import type { Title } from "./catalog";
export const normalTitle = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function franchiseKey(title: Title): string {
  if (title.collectionId) return `collection:${title.collectionId}`;
  const name = normalTitle(`${title.name} ${title.original || ""}`);
  for (const [id, pattern] of [
    ["spiderman", /spider ?man/],
    ["mission-impossible", /mission impossible/],
    ["avengers", /avengers/],
    ["iron-man", /iron man/],
    ["thor", /\bthor\b/],
    ["captain-america", /captain america/],
    ["hulk", /\bhulk\b/],
    ["batman", /batman|dark knight/],
    ["superman", /superman|man of steel/],
    ["xmen", /x men|wolverine/],
    ["deadpool", /deadpool/],
    ["guardians", /guardians of the galaxy|gardiens de la galaxie/],
    ["resident-evil", /resident evil/],
    ["star-wars", /star wars|guerre des etoiles/],
    ["harry-potter", /harry potter/],
    ["fast-furious", /fast.*furious/],
    ["robocop", /robocop/],
    ["transporteur", /transporteur|transporter/],
    ["teen-titans", /teen titans/],
    ["alien", /^alien(?: |$)/],
    ["jurassic", /jurassic/],
  ] as const)
    if (pattern.test(name)) return id;
  return title.id;
}
export function tasteFamily(
  title: Title,
  genres: number[] = title.genreIds || [],
): string {
  const text = normalTitle(
    `${title.name} ${title.original || ""} ${title.summary}`,
  );
  if (
    /super ?hero|super ?heros|super ?pouvoir|marvel|dc comics|spider ?man|avengers|iron man|captain america|hulk|superman|batman|x men|deadpool|teen titans|black panther|\bthor\b/.test(
      text,
    )
  )
    return "superheroes";
  if (
    /mission impossible|espion|secret agent|agent secret|espionage|\bspy\b/.test(
      text,
    )
  )
    return "espionage";
  if (
    /anime|manga|naruto|one piece|dragon ball|demon slayer|jujutsu|shingeki/.test(
      text,
    )
  )
    return "anime";
  if (
    /astronaut|spatial|space mission|\bmars\b|cosmos|interstellar|planete|galax/.test(
      text,
    )
  )
    return "space";
  if (
    genres.includes(27) ||
    /zombie|resident evil|horreur|haunted|terreur/.test(text)
  )
    return "horror";
  if (genres.includes(16)) return "animation";
  if (genres.includes(10749)) return "romance";
  if (genres.includes(99)) return "documentary";
  if (genres.includes(80) || genres.includes(9648)) return "crime";
  if (genres.includes(35)) return "comedy";
  if (genres.includes(878) || genres.includes(14)) return "imagination";
  if (genres.includes(18)) return "drama";
  if (genres.includes(12) || genres.includes(10751)) return "adventure";
  if (genres.includes(28) || genres.includes(53)) return "action";
  return `genres:${[...genres].sort((a, b) => a - b).join(":") || "other"}`;
}
export function balancedSeeds<T extends { title: Title }>(
  seeds: T[],
  genres: (title: Title) => number[],
): T[] {
  const families = new Map<string, T[]>();
  for (const seed of seeds) {
    const key = tasteFamily(seed.title, genres(seed.title));
    const group = families.get(key) || [];
    group.push(seed);
    families.set(key, group);
  }
  const result: T[] = [];
  let i = 0;
  while (result.length < seeds.length) {
    for (const group of families.values()) if (group[i]) result.push(group[i]);
    i++;
  }
  return result;
}

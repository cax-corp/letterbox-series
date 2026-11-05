import type { Candidate, RecommendationCursor } from "./recommendations";
import { localDay } from "./feed-history";
export type RecommendationSession = {
  day: string;
  profile: string;
  cursor: RecommendationCursor;
  candidates: Candidate[];
};
const prefix = "luma-recommendation-pool-v2:";
export function readRecommendationSession(
  account: string,
): RecommendationSession {
  try {
    const value = JSON.parse(localStorage.getItem(prefix + account) || "null");
    if (
      value?.day === localDay() &&
      typeof value.profile === "string" &&
      value.cursor &&
      typeof value.cursor === "object" &&
      Array.isArray(value.candidates)
    ) {
      const cursor = Object.fromEntries(
        Object.entries(value.cursor).filter(
          ([, v]) => v === null || (Number.isInteger(v) && Number(v) >= 0),
        ),
      );
      const candidates = value.candidates
        .filter(
          (c: any) =>
            c?.title?.kind === "movie" &&
            typeof c.title.id === "string" &&
            typeof c.title.name === "string" &&
            typeof c.title.summary === "string" &&
            Array.isArray(c.title.genres) &&
            Array.isArray(c.seeds),
        )
        .slice(-600);
      return { ...value, cursor, candidates };
    }
  } catch {
    /* A corrupt or absent cache is rebuilt from the catalogue. */
  }
  return { day: localDay(), profile: "", cursor: {}, candidates: [] };
}
export function saveRecommendationSession(
  account: string,
  profile: string,
  cursor: RecommendationCursor,
  candidates: Candidate[],
) {
  try {
    localStorage.setItem(
      prefix + account,
      JSON.stringify({
        day: localDay(),
        profile,
        cursor,
        candidates: candidates.slice(-600),
      }),
    );
  } catch {
    /* An optional cache never blocks the daily exclusion ledger. */
  }
}
export function mergeCandidates(previous: Candidate[], incoming: Candidate[]) {
  const pool = new Map(
    previous.map((c) => [c.title.id, { ...c, seeds: [...c.seeds] }]),
  );
  for (const candidate of incoming) {
    const old = pool.get(candidate.title.id);
    pool.set(candidate.title.id, {
      title: candidate.title,
      seeds: [
        ...(old?.seeds || []),
        ...candidate.seeds.filter(
          (s) => !old?.seeds.some((other) => other.id === s.id),
        ),
      ],
    });
  }
  return [...pool.values()];
}

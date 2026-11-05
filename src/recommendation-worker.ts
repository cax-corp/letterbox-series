import { rankRecommendations } from "./recommendations";
import type { RankAnswer, RankJob } from "./local-ranker";
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<RankJob>) => void;
  postMessage: (answer: RankAnswer) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({
      id: data.id,
      suggestions: rankRecommendations(
        data.profile,
        data.candidates,
        data.previous,
        data.limit,
      ),
    });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error:
        error instanceof Error
          ? error.message
          : "Le classement local n’a pas abouti.",
    });
  }
};

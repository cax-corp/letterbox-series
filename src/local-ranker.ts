import type { Candidate, Suggestion, TasteProfile } from "./recommendations";
import { rankRecommendations } from "./recommendations";
import type { Title } from "./catalog";
export type RankJob = {
  id: number;
  profile: TasteProfile;
  candidates: Candidate[];
  previous: Title[];
  limit: number;
};
export type RankAnswer = {
  id: number;
  suggestions?: Suggestion[];
  error?: string;
};
const aborted = () => new DOMException("Classement annulé", "AbortError");
type Pending = {
  resolve: (items: Suggestion[]) => void;
  reject: (error: unknown) => void;
  fallback: () => void;
  cleanup: () => void;
};
/** The model runs on the device, outside the UI thread. No requests or credentials enter this worker. */
export class LocalRanker {
  private worker: Worker | null = null;
  private broken = false;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  private start() {
    if (this.worker || this.broken) return;
    try {
      const worker = new Worker(
        new URL("./recommendation-worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<RankAnswer>) => {
        const answer = event.data,
          job = this.pending.get(answer.id);
        if (!job) return;
        this.pending.delete(answer.id);
        job.cleanup();
        if (answer.error) job.reject(new Error(answer.error));
        else job.resolve(answer.suggestions || []);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        this.broken = true;
        worker.terminate();
        this.worker = null;
        const jobs = [...this.pending.values()];
        this.pending.clear();
        for (const job of jobs) {
          job.cleanup();
          job.fallback();
        }
      };
      this.worker = worker;
    } catch {
      this.broken = true;
    }
  }
  rank(
    profile: TasteProfile,
    candidates: Candidate[],
    previous: Title[],
    signal?: AbortSignal,
  ): Promise<Suggestion[]> {
    if (signal?.aborted) return Promise.reject(aborted());
    if (!candidates.length) return Promise.resolve([]);
    // Reviews and episode histories are not inputs to the model and need not be cloned.
    const entries = profile.entries.map((entry) => ({
      ...entry,
      review: "",
      episodes: [],
      lists: undefined,
    }));
    const byId = new Map(entries.map((entry) => [entry.title.id, entry]));
    const safeProfile = {
      ...profile,
      entries,
      seeds: profile.seeds.map((seed) => byId.get(seed.title.id)!),
    };
    this.start();
    return new Promise((resolve, reject) => {
      const fallback = () =>
        setTimeout(() => {
          if (signal?.aborted) return reject(aborted());
          try {
            resolve(rankRecommendations(safeProfile, candidates, previous, 32));
          } catch (error) {
            reject(error);
          }
        }, 0);
      if (!this.worker) {
        fallback();
        return;
      }
      const id = ++this.sequence;
      const cancel = () => this.dispose();
      this.pending.set(id, {
        resolve,
        reject,
        fallback,
        cleanup: () => signal?.removeEventListener("abort", cancel),
      });
      signal?.addEventListener("abort", cancel, { once: true });
      try {
        this.worker.postMessage({
          id,
          profile: safeProfile,
          candidates,
          previous,
          limit: 32,
        } satisfies RankJob);
      } catch {
        const job = this.pending.get(id);
        this.pending.delete(id);
        job?.cleanup();
        fallback();
      }
    });
  }
  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.pending.values()) {
      job.cleanup();
      job.reject(aborted());
    }
    this.pending.clear();
  }
}

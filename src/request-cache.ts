type Cached = { value: unknown; expires: number; bytes: number };
type Flight = {
  controller: AbortController;
  promise: Promise<unknown>;
  readers: number;
};
/** Bounded public catalogue cache. Each caller keeps independent cancellation. */
export class RequestCache {
  private values = new Map<string, Cached>();
  private flights = new Map<string, Flight>();
  private bytes = 0;
  constructor(
    private maxEntries = 80,
    private maxBytes = 1500000,
    private now = Date.now,
  ) {}
  clear() {
    this.values.clear();
    this.bytes = 0;
  }
  async get<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    ttl: number,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const hit = this.values.get(key);
    if (hit && hit.expires > this.now()) {
      this.values.delete(key);
      this.values.set(key, hit);
      return structuredClone(hit.value) as T;
    }
    if (hit) {
      this.bytes -= hit.bytes;
      this.values.delete(key);
    }
    let flight = this.flights.get(key);
    if (flight?.controller.signal.aborted) flight = undefined;
    if (!flight) {
      const controller = new AbortController();
      const next: Flight = {
        controller,
        readers: 0,
        promise: Promise.resolve(),
      };
      next.promise = Promise.resolve()
        .then(() => load(controller.signal))
        .then((value) => {
          if (!controller.signal.aborted) {
            const bytes = JSON.stringify(value).length * 2;
            if (bytes <= this.maxBytes) {
              const old = this.values.get(key);
              if (old) this.bytes -= old.bytes;
              this.values.delete(key);
              this.values.set(key, {
                value: structuredClone(value),
                expires: this.now() + ttl,
                bytes,
              });
              this.bytes += bytes;
              while (
                this.values.size > this.maxEntries ||
                this.bytes > this.maxBytes
              ) {
                const first = this.values.keys().next().value!;
                this.bytes -= this.values.get(first)!.bytes;
                this.values.delete(first);
              }
            }
          }
          return value;
        })
        .finally(() => {
          if (this.flights.get(key) === next) this.flights.delete(key);
        });
      void next.promise.catch(() => {});
      this.flights.set(key, next);
      flight = next;
    }
    const current = flight;
    current.readers++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true;
        signal?.removeEventListener("abort", abort);
        current.readers--;
        return true;
      };
      const abort = () => {
        if (finish()) {
          reject(new DOMException("Cancelled", "AbortError"));
          if (!current.readers) current.controller.abort();
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }
      current.promise.then(
        (value) => {
          if (finish()) resolve(structuredClone(value) as T);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );
    });
  }
}
export const catalogCache = new RequestCache();

/** One cached value with a time-to-live; concurrent misses share one load. */
class TtlCache<T> {
    private value: T | undefined;
    private loadedAt = 0;
    private inFlight: Promise<T> | null = null;
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor({ ttlMs, now = Date.now }: { ttlMs: number; now?: () => number }) {
        this.ttlMs = ttlMs;
        this.now = now;
    }

    get(load: () => Promise<T>): Promise<T> {
        if (this.value !== undefined && this.now() - this.loadedAt < this.ttlMs) return Promise.resolve(this.value);
        if (this.inFlight) return this.inFlight;

        this.inFlight = load()
            .then((value) => {
                this.value = value;
                this.loadedAt = this.now();
                return value;
            })
            .finally(() => {
                this.inFlight = null;
            });
        return this.inFlight;
    }
}

export default TtlCache;

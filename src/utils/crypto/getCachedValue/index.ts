const cache = new Map<string, { value: unknown; expiresAt: number }>();

/**
 * In-memory TTL cache (per process). Loads on miss or expiry; failed loads
 * are not cached. Returns the value and when it expires.
 */
const getCachedValue = async <T>({
    key,
    ttlSeconds,
    load,
}: {
    key: string;
    ttlSeconds: number;
    load: () => Promise<T>;
}): Promise<{ value: T; expiresAt: Date }> => {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
        return { value: hit.value as T, expiresAt: new Date(hit.expiresAt) };
    }

    const value = await load();
    const expiresAt = now + ttlSeconds * 1000;
    cache.set(key, { value, expiresAt });
    return { value, expiresAt: new Date(expiresAt) };
};

export default getCachedValue;

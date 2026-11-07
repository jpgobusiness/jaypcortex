const WINDOW_MS = 60_000;
const LIMIT = 60;
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = LIMIT, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  return true;
}

const protectedKeyPattern = /^(currentPrice|price|lastPrice|close|trend|direction|signal|symbol|exchange|timeframe)$/i;
const lowPriorityKeyPattern = /(news|headline|history|historical|candle|ohlcv|chart|detail|items|payload|raw|gainer|loser)/i;

type JsonRecord = Record<string, unknown>;
type PathSegment = string | number;

function cloneJsonRecord(marketContext: JsonRecord): JsonRecord {
  const serialized = JSON.stringify(marketContext);
  if (serialized === undefined) return {};
  return JSON.parse(serialized) as JsonRecord;
}

function keyPriority(key: string): number {
  if (protectedKeyPattern.test(key)) return 3;
  if (lowPriorityKeyPattern.test(key)) return 0;
  return 1;
}

function collectRemovablePaths(value: unknown, path: PathSegment[] = [], entries: Array<{ path: PathSegment[]; priority: number }> = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRemovablePaths(item, [...path, index], entries));
    return entries;
  }
  if (!value || typeof value !== "object") return entries;

  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const childPath = [...path, key];
    if (!protectedKeyPattern.test(key)) entries.push({ path: childPath, priority: keyPriority(key) });
    collectRemovablePaths(child, childPath, entries);
  }
  return entries;
}

function removePath(root: JsonRecord, path: PathSegment[]) {
  let parent: unknown = root;
  for (const segment of path.slice(0, -1)) {
    if (!parent || typeof parent !== "object") return;
    parent = (parent as Record<PathSegment, unknown>)[segment];
  }
  const last = path.at(-1);
  if (last === undefined || !parent || typeof parent !== "object") return;
  if (Array.isArray(parent) && typeof last === "number") {
    parent.splice(last, 1);
  } else {
    delete (parent as Record<string, unknown>)[String(last)];
  }
}

/**
 * يحوّل سياق السوق إلى JSON صالح ضمن حد أحرف من دون قص النص في منتصف الكائن.
 * تُزال الحقول الأقل أهمية أولًا، بينما تبقى حقول السعر والاتجاه والرمز والإطار
 * ما دام الحد يسمح بتمثيلها JSON كاملًا.
 */
export function truncateMarketContext(marketContext: Record<string, unknown>, maxChars: number): string {
  const limit = Math.max(2, Math.floor(maxChars));
  const original = JSON.stringify(marketContext);
  if (original.length <= limit) return original;

  const compact = cloneJsonRecord(marketContext);
  const candidates = collectRemovablePaths(compact).sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    return right.path.length - left.path.length;
  });

  for (const candidate of candidates) {
    removePath(compact, candidate.path);
    const serialized = JSON.stringify(compact);
    if (serialized.length <= limit) return serialized;
  }

  const protectedOnly = retainProtectedFields(compact);
  const serializedProtected = JSON.stringify(protectedOnly);
  return serializedProtected.length <= limit ? serializedProtected : "{}";
}

function retainProtectedFields(value: unknown): JsonRecord {
  if (!value || typeof value !== "object") return {};
  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (protectedKeyPattern.test(key)) {
      result[key] = child;
      continue;
    }
    if (child && typeof child === "object") {
      const nested = retainProtectedFields(child);
      if (Object.keys(nested).length > 0) result[key] = nested;
    }
  }
  return result;
}

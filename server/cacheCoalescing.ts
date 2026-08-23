/**
 * مشاركة الطلب الجاري داخل عملية Node واحدة فقط. هذا يمنع تكرار جلب المصدر
 * الخارجي عند وصول طلبات متزامنة للمفتاح نفسه، ولا يحاول التنسيق بين replicas.
 */
export function createInFlightRequestCoalescer() {
  const inFlight = new Map<string, Promise<unknown>>();

  async function run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const request = Promise.resolve().then(load);
    inFlight.set(key, request);
    try {
      return await request;
    } finally {
      if (inFlight.get(key) === request) inFlight.delete(key);
    }
  }

  return { run, size: () => inFlight.size };
}

import { aiProviderDefinitions, type AiProviderId } from "../shared/aiProviders";
import { normalizeCustomBaseUrl, resolveOpenAiBaseUrl } from "./aiProviderBaseUrl";

export type AiProviderName = AiProviderId;

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;

export type ProviderConnectionResult =
  | { valid: true; message: string }
  | { valid: false; message: string };

export type ProviderModel = {
  id: string;
  label: string;
  owner: string | null;
};

export type ProviderModelListResult =
  | { success: true; models: ProviderModel[] }
  | { success: false; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeModels(items: unknown[], mapItem: (item: Record<string, unknown>) => ProviderModel | null) {
  const seen = new Set<string>();
  const mapped = items
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(mapItem);
  const unique: ProviderModel[] = [];
  for (const item of mapped) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.sort((left, right) => left.label.localeCompare(right.label)).slice(0, 500);
}

function buildModelListRequest(provider: AiProviderName, apiKey: string, customBaseUrl?: string | null): { url: string; init: RequestInit } {
  const definition = aiProviderDefinitions[provider];
  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/models?limit=100",
      init: { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } } satisfies RequestInit,
    };
  }
  if (provider === "google") {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      init: { headers: { "x-goog-api-key": apiKey } } satisfies RequestInit,
    };
  }
  if (definition.protocol === "openai") {
    const baseUrl = resolveOpenAiBaseUrl(provider, customBaseUrl);
    return {
      url: `${baseUrl}/models`,
      init: { headers: { Authorization: `Bearer ${apiKey}` } } satisfies RequestInit,
    };
  }
  throw new Error("تعذر تحديد واجهة كتالوج النماذج لهذا المزود.");
}

function safeCatalogFailureMessage(provider: AiProviderName, status: number) {
  const label = aiProviderDefinitions[provider].name;
  if (status === 401 || status === 403) return `تعذر جلب نماذج ${label}. تأكد من صحة المفتاح وصلاحياته.`;
  if (status === 429) return `وصل ${label} إلى حد الطلبات مؤقتًا. أعد جلب النماذج لاحقًا.`;
  if (status >= 500) return `كتالوج نماذج ${label} غير متاح مؤقتًا. أعد المحاولة لاحقًا.`;
  return `تعذر جلب قائمة نماذج ${label} الآن.`;
}

/**
 * يجلب معرّفات وعناوين النماذج فقط من الخادم. لا يعيد المفتاح أو استجابة
 * المزود كاملة، ولا يضع المفتاح في الرابط أو سجل الواجهة.
 */
export async function listProviderModels(
  input: { provider: AiProviderName; apiKey: string; customBaseUrl?: string | null },
  fetcher: FetchLike = fetch,
): Promise<ProviderModelListResult> {
  try {
    const request = buildModelListRequest(input.provider, input.apiKey, input.customBaseUrl);
    const response = await fetcher(request.url, request.init);
    if (!response.ok) return { success: false, message: safeCatalogFailureMessage(input.provider, response.status) };
    const payload = response.json ? await response.json() : null;
    const body = asRecord(payload);
    const rawItems = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
    const models = normalizeModels(rawItems, item => {
      if (input.provider === "google") {
        const methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
        if (!methods.includes("generateContent")) return null;
        const id = readText(item, "name")?.replace(/^models\//, "");
        return id ? { id, label: readText(item, "displayName") ?? id, owner: "Google" } : null;
      }
      const id = readText(item, "id");
      if (!id) return null;
      const label = input.provider === "anthropic"
        ? readText(item, "display_name") ?? id
        : input.provider === "zenmux"
          ? readText(item, "display_name") ?? id
          : readText(item, "name") ?? id;
      return { id, label, owner: readText(item, "owned_by") };
    });
    if (!models.length) return { success: false, message: `لم يُرجع ${aiProviderDefinitions[input.provider].name} نماذج محادثة قابلة للاختيار.` };
    return { success: true, models };
  } catch (error) {
    if (error instanceof Error && error.message.includes("عنوان API")) return { success: false, message: error.message };
    return { success: false, message: `تعذر الوصول إلى كتالوج نماذج ${aiProviderDefinitions[input.provider].name}. تحقق من الشبكة ثم أعد المحاولة.` };
  }
}

function buildVerificationRequest(provider: AiProviderName, apiKey: string, model: string, customBaseUrl?: string | null) {
  const normalizedModel = model.replace(/^models\//, "");
  const safeModel = normalizedModel.split("/").map(encodeURIComponent).join("/");
  const definition = aiProviderDefinitions[provider];

  if (provider === "openrouter" && !normalizeCustomBaseUrl(provider, customBaseUrl)) {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    return {
      url: `${definition.baseUrl}/key`,
      init: { headers } satisfies RequestInit,
    };
  }

  if (definition.protocol === "openai") {
    const baseUrl = resolveOpenAiBaseUrl(provider, customBaseUrl);
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    return {
      url: `${baseUrl}/models/${safeModel}`,
      init: { headers } satisfies RequestInit,
    };
  }

  if (provider === "anthropic") {
    const headers: Record<string, string> = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    return {
      url: `https://api.anthropic.com/v1/models/${safeModel}`,
      init: { headers } satisfies RequestInit,
    };
  }

  const headers: Record<string, string> = { "x-goog-api-key": apiKey };
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}`,
    init: { headers } satisfies RequestInit,
  };
}

function safeFailureMessage(provider: AiProviderName, status: number) {
  const label = aiProviderDefinitions[provider].name;
  if (status === 401 || status === 403) return `تعذر التحقق من مفتاح ${label}. تأكد من صحته وصلاحياته ثم أعد المحاولة.`;
  if (status === 404) return `مفتاح ${label} صالح على الأرجح، لكن النموذج المحدد غير متاح لهذا الحساب أو أن اسمه غير صحيح.`;
  if (status === 429) return `وصل مزود ${label} إلى حد الطلبات مؤقتًا. أعد اختبار المفتاح بعد قليل.`;
  if (status >= 500) return `مزود ${label} غير متاح مؤقتًا. لم يُحفظ المفتاح؛ أعد المحاولة لاحقًا.`;
  return `تعذر اختبار اتصال ${label} الآن. لم يُحفظ المفتاح.`;
}

/**
 * يتحقق من أن المفتاح قادر على قراءة النموذج المحدد فقط. لا ينشئ رسالة
 * ولا يعيد المفتاح أو نص الاستجابة أو أي ترويسات في النتيجة.
 */
export async function verifyProviderConnection(
  input: { provider: AiProviderName; apiKey: string; model: string; customBaseUrl?: string | null },
  fetcher: FetchLike = fetch,
): Promise<ProviderConnectionResult> {
  try {
    const request = buildVerificationRequest(input.provider, input.apiKey, input.model, input.customBaseUrl);
    const response = await fetcher(request.url, request.init);
    if (response.ok) {
      const message = input.provider === "openrouter"
        ? "نجح اختبار مفتاح OpenRouter دون تنفيذ توليد. سيستخدم التطبيق النموذج المحدد عند أول تحليل."
        : `نجح اختبار اتصال ${aiProviderDefinitions[input.provider].name} والنموذج المحدد.`;
      return { valid: true, message };
    }
    return { valid: false, message: safeFailureMessage(input.provider, response.status) };
  } catch (error) {
    if (error instanceof Error && error.message.includes("عنوان API")) return { valid: false, message: error.message };
    return { valid: false, message: `تعذر الوصول إلى ${aiProviderDefinitions[input.provider].name} أثناء الاختبار. تحقق من الشبكة ثم أعد المحاولة.` };
  }
}

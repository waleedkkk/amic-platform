import { aiProviderDefinitions, type AiProviderId } from "../shared/aiProviders";

export type AiProviderName = AiProviderId;

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

export type ProviderConnectionResult =
  | { valid: true; message: string }
  | { valid: false; message: string };

function buildVerificationRequest(provider: AiProviderName, apiKey: string, model: string) {
  const normalizedModel = model.replace(/^models\//, "");
  const safeModel = normalizedModel.split("/").map(encodeURIComponent).join("/");
  const definition = aiProviderDefinitions[provider];

  if (provider === "openai") {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    return {
      url: `https://api.openai.com/v1/models/${safeModel}`,
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

  if (provider === "openrouter") {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    return {
      url: `${definition.baseUrl}/key`,
      init: { headers } satisfies RequestInit,
    };
  }

  if (definition.protocol === "openai") {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    return {
      url: `${definition.baseUrl}/models/${safeModel}`,
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
  input: { provider: AiProviderName; apiKey: string; model: string },
  fetcher: FetchLike = fetch,
): Promise<ProviderConnectionResult> {
  const request = buildVerificationRequest(input.provider, input.apiKey, input.model);
  try {
    const response = await fetcher(request.url, request.init);
    if (response.ok) {
      const message = input.provider === "openrouter"
        ? "نجح اختبار مفتاح OpenRouter دون تنفيذ توليد. سيستخدم التطبيق النموذج المحدد عند أول تحليل."
        : `نجح اختبار اتصال ${aiProviderDefinitions[input.provider].name} والنموذج المحدد.`;
      return { valid: true, message };
    }
    return { valid: false, message: safeFailureMessage(input.provider, response.status) };
  } catch {
    return { valid: false, message: `تعذر الوصول إلى ${aiProviderDefinitions[input.provider].name} أثناء الاختبار. تحقق من الشبكة ثم أعد المحاولة.` };
  }
}

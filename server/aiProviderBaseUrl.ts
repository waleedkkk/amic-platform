import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { aiProviderDefinitions, type AiProviderId } from "../shared/aiProviders";

function isOpenAiCompatible(provider: AiProviderId) {
  return aiProviderDefinitions[provider].protocol === "openai";
}

function isPrivateOrReservedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return false;
}

/**
 * يطبع عنوانًا آمنًا شكليًا ويمنع بروتوكولات غير HTTPS والمضيفات المحلية.
 * لا تُعاد أي معلومات سرية من هذه الطبقة؛ العنوان ليس مفتاحًا لكنه يُعامل
 * كمدخل حساس لأنه يحدد وجهة اتصال الخادم.
 */
export function normalizeCustomBaseUrl(provider: AiProviderId, rawUrl?: string | null) {
  const value = rawUrl?.trim();
  if (!value) return null;
  if (!isOpenAiCompatible(provider)) throw new Error("عنوان API المخصص متاح للمزودات المتوافقة مع OpenAI فقط.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("أدخل عنوان API صحيحًا يبدأ بـ https://.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) {
    throw new Error("عنوان API المخصص يجب أن يكون HTTPS دون بيانات دخول أو معاملات إضافية.");
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || isIP(hostname)) {
    throw new Error("لا يُسمح بعناوين API محلية أو بعناوين IP مباشرة.");
  }
  return url.toString().replace(/\/+$/, "");
}

/** يفحص DNS قبل حفظ الوجهة لمنع النطاقات التي تشير إلى شبكات داخلية. */
export async function validateCustomBaseUrl(provider: AiProviderId, rawUrl?: string | null) {
  const normalized = normalizeCustomBaseUrl(provider, rawUrl);
  if (!normalized) return null;
  const hostname = new URL(normalized).hostname;
  let addresses: Awaited<ReturnType<typeof lookup>>[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("تعذر التحقق من نطاق عنوان API المخصص. تحقق من اسم النطاق ثم أعد المحاولة.");
  }
  if (!addresses.length || addresses.some(result => isPrivateOrReservedAddress(result.address))) {
    throw new Error("عنوان API المخصص يشير إلى شبكة محلية أو محجوزة، ولذلك رُفض لأسباب أمنية.");
  }
  return normalized;
}

export function resolveOpenAiBaseUrl(provider: AiProviderId, customBaseUrl?: string | null) {
  if (!isOpenAiCompatible(provider)) throw new Error("هذا المزود لا يستخدم واجهة OpenAI المتوافقة.");
  return normalizeCustomBaseUrl(provider, customBaseUrl) ?? aiProviderDefinitions[provider].baseUrl ?? "https://api.openai.com/v1";
}

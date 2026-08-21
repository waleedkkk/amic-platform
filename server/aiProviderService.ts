import { and, eq } from "drizzle-orm";
import { aiProviderSettings } from "../drizzle/schema";
import { decryptProviderKey } from "./aiProviderCrypto";
import { getDb } from "./db";
import { aiProviderDefinitions, type AiProviderId } from "../shared/aiProviders";
import { resolveOpenAiBaseUrl } from "./aiProviderBaseUrl";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ProviderName = AiProviderId;

function providerError(provider: string, status: number) {
  return new Error(`تعذر الاتصال بمزود ${provider} (رمز الاستجابة ${status}). تحقق من المفتاح واسم النموذج ثم أعد المحاولة.`);
}

async function requestJson(url: string, init: RequestInit, provider: string) {
  const response = await fetch(url, init);
  if (!response.ok) throw providerError(provider, response.status);
  return response.json() as Promise<Record<string, unknown>>;
}

function systemText(messages: ChatMessage[]) {
  return messages.filter(message => message.role === "system").map(message => message.content).join("\n\n");
}

function conversationMessages(messages: ChatMessage[]) {
  return messages.filter(message => message.role !== "system");
}

async function invokeOpenAi(apiKey: string, model: string, maxOutputTokens: number, messages: ChatMessage[]) {
  return invokeOpenAiCompatible("https://api.openai.com/v1", "OpenAI", apiKey, model, maxOutputTokens, messages);
}

async function invokeOpenAiCompatible(baseUrl: string, providerLabel: string, apiKey: string, model: string, maxOutputTokens: number, messages: ChatMessage[]) {
  const payload = await requestJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxOutputTokens, messages }),
    },
    providerLabel,
  );
  const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content?.trim() || "لم يُرجع مزود OpenAI محتوى صالحًا.";
}

async function invokeAnthropic(apiKey: string, model: string, maxOutputTokens: number, messages: ChatMessage[]) {
  const payload = await requestJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        system: systemText(messages),
        messages: conversationMessages(messages).map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
      }),
    },
    "Anthropic",
  );
  const content = payload.content as Array<{ type?: string; text?: string }> | undefined;
  return content?.filter(item => item.type === "text").map(item => item.text ?? "").join("\n").trim() || "لم يُرجع مزود Anthropic محتوى صالحًا.";
}

async function invokeGoogle(apiKey: string, model: string, maxOutputTokens: number, messages: ChatMessage[]) {
  const normalizedModel = model.replace(/^models\//, "");
  const payload = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText(messages) }] },
        generationConfig: { maxOutputTokens },
        contents: conversationMessages(messages).map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      }),
    },
    "Google Gemini",
  );
  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("\n").trim() || "لم يُرجع مزود Google Gemini محتوى صالحًا.";
}

export async function invokeConfiguredProvider(messages: ChatMessage[]) {
  const db = await getDb();
  if (!db) return null;
  const [setting] = await db
    .select()
    .from(aiProviderSettings)
    .where(and(eq(aiProviderSettings.enabled, 1), eq(aiProviderSettings.isActive, 1)))
    .limit(1);
  if (!setting?.encryptedApiKey) return null;

  const apiKey = decryptProviderKey(setting.encryptedApiKey);
  const provider = setting.provider as ProviderName;
  const model = setting.model;
  const maxOutputTokens = setting.maxOutputTokens;
  let content: string;
  if (provider === "openai") {
    content = setting.customBaseUrl
      ? await invokeOpenAiCompatible(resolveOpenAiBaseUrl(provider, setting.customBaseUrl), "OpenAI-compatible", apiKey, model, maxOutputTokens, messages)
      : await invokeOpenAi(apiKey, model, maxOutputTokens, messages);
  }
  else if (provider === "anthropic") content = await invokeAnthropic(apiKey, model, maxOutputTokens, messages);
  else if (provider === "google") content = await invokeGoogle(apiKey, model, maxOutputTokens, messages);
  else if (provider === "openrouter" || provider === "zenmux") {
    const definition = aiProviderDefinitions[provider];
    content = await invokeOpenAiCompatible(resolveOpenAiBaseUrl(provider, setting.customBaseUrl), definition.name, apiKey, model, maxOutputTokens, messages);
  }
  else throw new Error("مزود الذكاء الاصطناعي المحدد غير مدعوم.");
  return { content, provider, model };
}

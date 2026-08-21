export const aiProviderIds = ["openai", "anthropic", "google", "openrouter", "zenmux"] as const;

export type AiProviderId = (typeof aiProviderIds)[number];

export type AiProviderDefinition = {
  name: string;
  subtitle: string;
  defaultModel: string;
  placeholder: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl?: string;
};

export const aiProviderDefinitions: Record<AiProviderId, AiProviderDefinition> = {
  openai: {
    name: "OpenAI",
    subtitle: "GPT",
    defaultModel: "gpt-4o-mini",
    placeholder: "sk-...",
    protocol: "openai",
  },
  anthropic: {
    name: "Anthropic",
    subtitle: "Claude",
    defaultModel: "claude-3-5-haiku-latest",
    placeholder: "sk-ant-...",
    protocol: "anthropic",
  },
  google: {
    name: "Google Gemini",
    subtitle: "Gemini",
    defaultModel: "gemini-2.0-flash",
    placeholder: "AIza...",
    protocol: "google",
  },
  openrouter: {
    name: "OpenRouter",
    subtitle: "بوابة موحّدة متوافقة مع OpenAI",
    defaultModel: "openai/gpt-4o-mini",
    placeholder: "sk-or-...",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  zenmux: {
    name: "ZenMux.ai",
    subtitle: "بوابة نماذج متوافقة مع OpenAI",
    defaultModel: "google/gemini-3.1-pro-preview",
    placeholder: "zm-...",
    protocol: "openai",
    baseUrl: "https://zenmux.ai/api/v1",
  },
};

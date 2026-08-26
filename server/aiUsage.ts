export type AiReportedUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asTokenCount(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export function normalizeAiUsage(input: { inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown }): AiReportedUsage | null {
  const inputTokens = asTokenCount(input.inputTokens);
  const outputTokens = asTokenCount(input.outputTokens);
  const providerTotal = asTokenCount(input.totalTokens);
  const totalTokens = providerTotal ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  return inputTokens === null && outputTokens === null && totalTokens === null ? null : { inputTokens, outputTokens, totalTokens };
}

export function usageFromOpenAiPayload(payload: Record<string, unknown>) {
  const usage = asRecord(payload.usage);
  return normalizeAiUsage({ inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
}

export function usageFromAnthropicPayload(payload: Record<string, unknown>) {
  const usage = asRecord(payload.usage);
  return normalizeAiUsage({ inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens });
}

export function usageFromGooglePayload(payload: Record<string, unknown>) {
  const usage = asRecord(payload.usageMetadata);
  return normalizeAiUsage({ inputTokens: usage?.promptTokenCount, outputTokens: usage?.candidatesTokenCount, totalTokens: usage?.totalTokenCount });
}

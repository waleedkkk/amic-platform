import { describe, expect, it } from "vitest";
import { usageFromAnthropicPayload, usageFromGooglePayload, usageFromOpenAiPayload } from "./aiUsage";

describe("AI usage normalization", () => {
  it("يقرأ استهلاك OpenAI المبلغ عنه كما هو", () => {
    expect(usageFromOpenAiPayload({ usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } })).toEqual({ inputTokens: 120, outputTokens: 30, totalTokens: 150 });
  });

  it("يحسب الإجمالي فقط عندما يبلغ المزود عن المدخلات والمخرجات", () => {
    expect(usageFromAnthropicPayload({ usage: { input_tokens: 40, output_tokens: 15 } })).toEqual({ inputTokens: 40, outputTokens: 15, totalTokens: 55 });
    expect(usageFromGooglePayload({ usageMetadata: { promptTokenCount: 21, candidatesTokenCount: 9, totalTokenCount: 33 } })).toEqual({ inputTokens: 21, outputTokens: 9, totalTokens: 33 });
  });

  it("لا يخترع استهلاكًا عند غياب بيانات المزود أو كونها غير صالحة", () => {
    expect(usageFromOpenAiPayload({})).toBeNull();
    expect(usageFromGooglePayload({ usageMetadata: { totalTokenCount: -3 } })).toBeNull();
  });
});

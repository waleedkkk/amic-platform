import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: { forgeApiKey: "test-forge-key", forgeApiUrl: "https://forge.example" },
}));

import { invokeLLM } from "./llm";

describe("invokeLLM وتاريخ استدعاء الأدوات", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("يحافظ على tool_calls في رسالة المساعد ويرسل نتيجة الأداة مع معرفها", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "response",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "تم" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "gpt-5-mini",
      maxCompletionTokens: 1_600,
      messages: [
        {
          role: "assistant",
          content: "",
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: { name: "coin_analysis", arguments: '{"symbol":"BTCUSDT"}' },
          }],
        },
        { role: "tool", tool_call_id: "call-1", content: '{"ok":true}' },
      ],
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.messages).toEqual([
      expect.objectContaining({
        role: "assistant",
        content: "",
        tool_calls: [{
          id: "call-1",
          type: "function",
          function: { name: "coin_analysis", arguments: '{"symbol":"BTCUSDT"}' },
        }],
      }),
      { role: "tool", tool_call_id: "call-1", content: '{"ok":true}' },
    ]);
    expect(payload.max_completion_tokens).toBe(1_600);
  });
});

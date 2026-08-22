import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

const llmMocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
const providerMocks = vi.hoisted(() => ({ invokeConfiguredProvider: vi.fn() }));
const mcpMocks = vi.hoisted(() => ({ callTradingViewTool: vi.fn() }));

vi.mock("../_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("../_core/llm")>();
  return { ...actual, invokeLLM: llmMocks.invokeLLM };
});
vi.mock("../aiProviderService", () => providerMocks);
vi.mock("../mcpClient", () => mcpMocks);

import { aiRouter } from "./ai";

const context: TrpcContext = {
  user: { id: 1 } as User,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const finalResponse = (content: string) => ({
  choices: [{ index: 0, message: { role: "assistant" as const, content }, finish_reason: "stop" }],
  id: "response",
  created: 0,
  model: "gpt-5-mini",
});

const toolResponse = (id: string, name: string, args: string) => ({
  choices: [{
    index: 0,
    message: {
      role: "assistant" as const,
      content: "",
      tool_calls: [{ id, type: "function" as const, function: { name, arguments: args } }],
    },
    finish_reason: "tool_calls",
  }],
  id: "response",
  created: 0,
  model: "gpt-5-mini",
});

describe("aiRouter.explain مع أدوات السوق", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMocks.invokeConfiguredProvider.mockResolvedValue(null);
  });

  it("يعيد إجابة عادية بلا استدعاء MCP ويحافظ على سياق السوق في رسالة النظام", async () => {
    llmMocks.invokeLLM.mockResolvedValue(finalResponse("قراءة تعليمية موجزة."));
    const caller = aiRouter.createCaller(context);

    await expect(caller.explain({
      messages: [{ role: "user", content: "لخّص السوق" }],
      marketContext: { globalSnapshot: { state: "neutral" } },
    })).resolves.toEqual({ content: "قراءة تعليمية موجزة." });

    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
    expect(llmMocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      tools: expect.arrayContaining([expect.objectContaining({ function: expect.objectContaining({ name: "coin_analysis" }) })]),
      toolChoice: "auto",
      maxCompletionTokens: 1_600,
      reasoning: { effort: "low" },
    }));
    expect(llmMocks.invokeLLM.mock.calls[0][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "system", content: expect.stringContaining("سياق السوق الحالي") }),
    ]));
  });

  it("ينفذ استدعاء الأداة بعد تطبيع الوسائط ثم يعيد النتيجة إلى جولة النموذج التالية", async () => {
    llmMocks.invokeLLM
      .mockResolvedValueOnce(toolResponse("call-1", "coin_analysis", '{"symbol":" btcusdt ","exchange":"binance","timeframe":"1h"}'))
      .mockResolvedValueOnce(finalResponse("توضح القراءة توافقًا تعليميًا بين المؤشرات."));
    mcpMocks.callTradingViewTool.mockResolvedValue({ signal: "neutral" });
    const caller = aiRouter.createCaller(context);

    await expect(caller.explain({ messages: [{ role: "user", content: "حلل BTC" }] }))
      .resolves.toEqual({ content: "توضح القراءة توافقًا تعليميًا بين المؤشرات." });

    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("coin_analysis", {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      timeframe: "1h",
    });
    expect(llmMocks.invokeLLM).toHaveBeenCalledTimes(2);
    expect(llmMocks.invokeLLM.mock.calls[1][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "assistant", tool_calls: expect.any(Array) }),
      expect.objectContaining({ role: "tool", tool_call_id: "call-1", content: expect.stringContaining("neutral") }),
    ]));
  });

  it("لا يمرر أداة أو رمزًا غير معتمدين إلى MCP", async () => {
    llmMocks.invokeLLM
      .mockResolvedValueOnce(toolResponse("call-bad-tool", "market_snapshot", "{}"))
      .mockResolvedValueOnce(toolResponse("call-bad-symbol", "coin_analysis", '{"symbol":"BTC USDT"}'))
      .mockResolvedValueOnce(finalResponse("تعذر جلب البيانات المطلوبة بأمان."));
    const caller = aiRouter.createCaller(context);

    await caller.explain({ messages: [{ role: "user", content: "أعطني بيانات" }] });

    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
    expect(llmMocks.invokeLLM.mock.calls[1][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "tool", content: expect.stringContaining("غير مسموح") }),
    ]));
  });

  it("يوقف حلقة الأدوات بعد ثلاث جولات بدل الاستدعاء غير المحدود", async () => {
    llmMocks.invokeLLM.mockResolvedValue(toolResponse("call-loop", "top_gainers", "{}"));
    mcpMocks.callTradingViewTool.mockResolvedValue([{ symbol: "BTCUSDT" }]);
    const caller = aiRouter.createCaller(context);

    await expect(caller.explain({ messages: [{ role: "user", content: "استمر" }] }))
      .resolves.toEqual(expect.objectContaining({ content: expect.stringContaining("الحد الأقصى") }));

    expect(llmMocks.invokeLLM).toHaveBeenCalledTimes(3);
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledTimes(3);
  });

  it("يستخدم مزود لوحة الإدارة النصي فقط كاحتياط عند تعذر النموذج المدمج", async () => {
    llmMocks.invokeLLM.mockRejectedValue(new Error("Forge unavailable"));
    providerMocks.invokeConfiguredProvider.mockResolvedValue({ content: "إجابة احتياطية تعليمية." });
    const caller = aiRouter.createCaller(context);

    await expect(caller.explain({ messages: [{ role: "user", content: "فسر RSI" }] }))
      .resolves.toEqual({ content: "إجابة احتياطية تعليمية." });

    expect(providerMocks.invokeConfiguredProvider).toHaveBeenCalledTimes(1);
    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });
});

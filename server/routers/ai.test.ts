import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

const llmMocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
const providerMocks = vi.hoisted(() => ({ invokeConfiguredProvider: vi.fn() }));
const mcpMocks = vi.hoisted(() => ({ callTradingViewTool: vi.fn() }));
const memoryMocks = vi.hoisted(() => ({
  appendUserAssistantMemory: vi.fn(),
  clearUserAssistantMemory: vi.fn(),
  getUserAssistantMemory: vi.fn(),
  recordAiModelUsage: vi.fn(),
  setUserAssistantMemoryEnabled: vi.fn(),
}));

vi.mock("../_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("../_core/llm")>();
  return { ...actual, invokeLLM: llmMocks.invokeLLM };
});
vi.mock("../aiProviderService", () => providerMocks);
vi.mock("../mcpClient", () => mcpMocks);
vi.mock("../db", () => memoryMocks);

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

const multiToolResponse = (calls: Array<{ id: string; name: string; args: string }>) => ({
  choices: [{
    index: 0,
    message: {
      role: "assistant" as const,
      content: "",
      tool_calls: calls.map(call => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.args } })),
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
    memoryMocks.getUserAssistantMemory.mockResolvedValue({ enabled: false, messages: [] });
    memoryMocks.appendUserAssistantMemory.mockResolvedValue(undefined);
    memoryMocks.recordAiModelUsage.mockResolvedValue(undefined);
  });

  it("يعيد إجابة عادية بلا استدعاء MCP ويحافظ على سياق السوق في رسالة النظام", async () => {
    llmMocks.invokeLLM.mockResolvedValue(finalResponse("قراءة تعليمية موجزة."));
    const caller = aiRouter.createCaller(context);

    await expect(caller.explain({
      messages: [{ role: "user", content: "لخّص السوق" }],
      marketContext: { globalSnapshot: { state: "neutral" } },
    })).resolves.toEqual({ content: "قراءة تعليمية موجزة.", toolActivity: [] });

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
      .resolves.toEqual(expect.objectContaining({
        content: "توضح القراءة توافقًا تعليميًا بين المؤشرات.",
        toolActivity: [expect.objectContaining({ toolName: "coin_analysis", source: "TradingView MCP", fetchedAt: expect.any(String) })],
      }));

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

  it("يشغّل الأدوات المستقلة في الجولة نفسها بالتوازي ويحافظ على ترتيب رسائلها", async () => {
    llmMocks.invokeLLM
      .mockResolvedValueOnce(multiToolResponse([
        { id: "call-first", name: "top_gainers", args: '{"exchange":"BINANCE","timeframe":"1h"}' },
        { id: "call-second", name: "top_losers", args: '{"exchange":"BINANCE","timeframe":"1h"}' },
      ]))
      .mockResolvedValueOnce(finalResponse("اكتملت القراءتان بالتوازي."));
    const resolvers: Array<(value: unknown) => void> = [];
    mcpMocks.callTradingViewTool.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
    const caller = aiRouter.createCaller(context);

    const response = caller.explain({ messages: [{ role: "user", content: "أعطني الرابحين والخاسرين" }] });
    await vi.waitFor(() => expect(mcpMocks.callTradingViewTool).toHaveBeenCalledTimes(2));
    // لو كان التنفيذ متسلسلًا لما بدأت الأداة الثانية قبل حل الأولى.
    expect(resolvers).toHaveLength(2);
    resolvers[1]!([{ symbol: "LOSS" }]);
    resolvers[0]!([{ symbol: "GAIN" }]);

    await expect(response).resolves.toEqual(expect.objectContaining({
      content: "اكتملت القراءتان بالتوازي.",
      toolActivity: [expect.objectContaining({ toolName: "top_gainers" }), expect.objectContaining({ toolName: "top_losers" })],
    }));
    const secondRoundMessages = llmMocks.invokeLLM.mock.calls[1][0].messages;
    const toolMessages = secondRoundMessages.filter((item: { role: string }) => item.role === "tool");
    expect(toolMessages.map((item: { tool_call_id?: string }) => item.tool_call_id)).toEqual(["call-first", "call-second"]);
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
      .resolves.toEqual({ content: "إجابة احتياطية تعليمية.", toolActivity: [] });

    expect(providerMocks.invokeConfiguredProvider).toHaveBeenCalledTimes(1);
    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });

  it("يضيف ذاكرة هذا المستخدم فقط إلى السياق ويحفظ الزوج الجديد عندما تكون مفعلة", async () => {
    memoryMocks.getUserAssistantMemory.mockResolvedValue({
      enabled: true,
      messages: [
        { role: "user", content: "أفضل القراءة متعددة الأطر." },
        { role: "assistant", content: "سأستخدم هذا التفضيل كسياق تعليمي." },
      ],
    });
    llmMocks.invokeLLM.mockResolvedValue(finalResponse("سأربط القراءة الحالية بتوافق الأطر."));
    const caller = aiRouter.createCaller(context);

    await caller.explain({ messages: [{ role: "user", content: "حلل BTC" }] });

    expect(llmMocks.invokeLLM.mock.calls[0][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "system", content: expect.stringContaining("سجل الذاكرة") }),
      { role: "user", content: "أفضل القراءة متعددة الأطر." },
      { role: "assistant", content: "سأستخدم هذا التفضيل كسياق تعليمي." },
    ]));
    expect(memoryMocks.appendUserAssistantMemory).toHaveBeenCalledWith(1, [
      { role: "user", content: "حلل BTC" },
      { role: "assistant", content: "سأربط القراءة الحالية بتوافق الأطر." },
    ]);
  });

  it("يعزل تحكم الذاكرة ضمن المستخدم الحالي", async () => {
    memoryMocks.getUserAssistantMemory.mockResolvedValue({ enabled: true, messages: [] });
    memoryMocks.setUserAssistantMemoryEnabled.mockResolvedValue({ enabled: false });
    memoryMocks.clearUserAssistantMemory.mockResolvedValue({ success: true });
    const caller = aiRouter.createCaller(context);

    await expect(caller.memory.get()).resolves.toEqual({ enabled: true });
    await expect(caller.memory.setEnabled({ enabled: false })).resolves.toEqual({ enabled: false });
    await expect(caller.memory.clear()).resolves.toEqual({ success: true });

    expect(memoryMocks.setUserAssistantMemoryEnabled).toHaveBeenCalledWith(1, false);
    expect(memoryMocks.clearUserAssistantMemory).toHaveBeenCalledWith(1);
  });
});

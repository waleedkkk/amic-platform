import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => {
  const connect = vi.fn();
  const callTool = vi.fn();
  const listTools = vi.fn();
  const close = vi.fn();

  const Client = vi.fn(function MockClient(this: Record<string, unknown>) {
    this.connect = connect;
    this.callTool = callTool;
    this.listTools = listTools;
  });

  const StreamableHTTPClientTransport = vi.fn(function MockTransport(this: Record<string, unknown>) {
    this.close = close;
  });

  return { Client, StreamableHTTPClientTransport, callTool, close, connect, listTools };
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({ Client: sdkMocks.Client }));
vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: sdkMocks.StreamableHTTPClientTransport,
}));

describe("اتصال TradingView MCP المشترك", () => {
  beforeEach(() => {
    vi.resetModules();
    sdkMocks.connect.mockReset();
    sdkMocks.callTool.mockReset();
    sdkMocks.listTools.mockReset();
    sdkMocks.close.mockReset();
    sdkMocks.close.mockResolvedValue(undefined);
  });

  it("يشارك اتصالًا واحدًا بين طلبين متوازيين", async () => {
    sdkMocks.connect.mockResolvedValue(undefined);
    sdkMocks.callTool.mockResolvedValue({ content: [{ type: "text", text: '{"signal":"neutral"}' }] });
    const { callTradingViewTool, closeTradingViewMcpConnection } = await import("./mcpClient");

    await Promise.all([
      callTradingViewTool("coin_analysis", { symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" }),
      callTradingViewTool("coin_analysis", { symbol: "ETHUSDT", exchange: "BINANCE", timeframe: "1h" }),
    ]);

    expect(sdkMocks.connect).toHaveBeenCalledTimes(1);
    expect(sdkMocks.callTool).toHaveBeenCalledTimes(2);
    await closeTradingViewMcpConnection();
  });

  it("يبطل الاتصال الفاشل ثم يعيد إنشاءه ويعيد تنفيذ استدعاء القراءة", async () => {
    sdkMocks.connect.mockResolvedValue(undefined);
    sdkMocks.callTool
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{"signal":"buy"}' }] });
    const { callTradingViewTool, closeTradingViewMcpConnection } = await import("./mcpClient");

    await expect(callTradingViewTool("coin_analysis", {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      timeframe: "15m",
    })).resolves.toEqual({ signal: "buy" });

    expect(sdkMocks.connect).toHaveBeenCalledTimes(2);
    expect(sdkMocks.close).toHaveBeenCalledTimes(1);
    expect(sdkMocks.callTool).toHaveBeenCalledTimes(2);
    await closeTradingViewMcpConnection();
  });

  it("يعيد المحاولة بأمان عندما يفشل تأسيس الاتصال قبل الحصول على عميل", async () => {
    sdkMocks.connect
      .mockRejectedValueOnce(new Error("MCP unavailable"))
      .mockResolvedValueOnce(undefined);
    sdkMocks.callTool.mockResolvedValue({ content: [{ type: "text", text: '{"signal":"sell"}' }] });
    const { callTradingViewTool, closeTradingViewMcpConnection } = await import("./mcpClient");

    await expect(callTradingViewTool("coin_analysis", {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      timeframe: "4h",
    })).resolves.toEqual({ signal: "sell" });

    expect(sdkMocks.connect).toHaveBeenCalledTimes(2);
    expect(sdkMocks.callTool).toHaveBeenCalledTimes(1);
    await closeTradingViewMcpConnection();
  });
});

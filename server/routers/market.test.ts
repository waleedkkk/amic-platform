import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  getMarketSnapshot: vi.fn(),
  saveMarketSnapshot: vi.fn(),
}));

const mcpMocks = vi.hoisted(() => ({
  callTradingViewTool: vi.fn(),
  listTradingViewTools: vi.fn(),
  TRADINGVIEW_TOOL_NAMES: ["coin_analysis", "top_gainers", "rating_filter"] as const,
}));

vi.mock("../db", () => databaseMocks);
vi.mock("../mcpClient", () => mcpMocks);

import { marketRouter } from "./market";

const publicContext: TrpcContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("marketRouter.analysis", () => {
  it("يرفض إطارًا زمنيًا غير مدعوم قبل الاتصال بمزود السوق", async () => {
    const caller = marketRouter.createCaller(publicContext);

    await expect(caller.analysis({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "2h" as "1h" }))
      .rejects.toThrow();

    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });

  it("يعيد النتيجة المخزنة ولا يستدعي موفر السوق عندما تكون صالحة", async () => {
    databaseMocks.getMarketSnapshot.mockResolvedValue({ signal: "neutral" });
    const caller = marketRouter.createCaller(publicContext);

    const result = await caller.analysis({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" });

    expect(result).toEqual({ signal: "neutral" });
    expect(databaseMocks.getMarketSnapshot).toHaveBeenCalledWith("analysis:BINANCE:BTCUSDT:1h");
    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });

  it("يطلب التحليل ويحفظه مؤقتًا عند غياب النتيجة المخزنة", async () => {
    databaseMocks.getMarketSnapshot.mockResolvedValue(undefined);
    databaseMocks.saveMarketSnapshot.mockResolvedValue(undefined);
    mcpMocks.callTradingViewTool.mockResolvedValue({ signal: "buy" });
    const caller = marketRouter.createCaller(publicContext);

    const result = await caller.analysis({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "4h" });

    expect(result).toEqual({ signal: "buy" });
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("coin_analysis", {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      timeframe: "4h",
    });
    expect(databaseMocks.saveMarketSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      cacheKey: "analysis:BINANCE:BTCUSDT:4h",
      exchange: "BINANCE",
      timeframe: "4h",
      payload: { signal: "buy" },
    }));
  });
});

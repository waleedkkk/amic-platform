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
    databaseMocks.getMarketSnapshot.mockResolvedValue({ schemaVersion: 1, recommendation: { signal: "neutral" } });
    const caller = marketRouter.createCaller(publicContext);

    const result = await caller.analysis({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" });

    expect(result).toEqual({ schemaVersion: 1, recommendation: { signal: "neutral" } });
    expect(databaseMocks.getMarketSnapshot).toHaveBeenCalledWith("analysis:v2:BINANCE:BTCUSDT:1h");
    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });

  it("يطلب التحليل ويحفظه مؤقتًا عند غياب النتيجة المخزنة", async () => {
    databaseMocks.getMarketSnapshot.mockResolvedValue(undefined);
    databaseMocks.saveMarketSnapshot.mockResolvedValue(undefined);
    mcpMocks.callTradingViewTool.mockResolvedValue({
      price_data: { current_price: 100 },
      market_sentiment: { buy_sell_signal: "BUY" },
      bollinger_bands: { middle: 99 },
    });
    const caller = marketRouter.createCaller(publicContext);

    const result = await caller.analysis({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "4h" });

    expect(result).toMatchObject({
      schemaVersion: 1,
      recommendation: { signal: "buy" },
      price: { current: 100 },
      indicators: { bollinger: { middle: 99 } },
    });
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("coin_analysis", {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      timeframe: "4h",
    });
    expect(databaseMocks.saveMarketSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      cacheKey: "analysis:v2:BINANCE:BTCUSDT:4h",
      exchange: "BINANCE",
      timeframe: "4h",
      payload: expect.objectContaining({ schemaVersion: 1, recommendation: expect.objectContaining({ signal: "buy" }) }),
    }));
  });
});

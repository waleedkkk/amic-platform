import { beforeEach, describe, expect, it, vi } from "vitest";

const mcpMocks = vi.hoisted(() => ({ callTradingViewTool: vi.fn() }));
const dbMocks = vi.hoisted(() => ({ listActiveDailyMarketDigestSubscriptions: vi.fn(), recordEconomicCalendarDelivery: vi.fn() }));
vi.mock("./mcpClient", () => mcpMocks);
vi.mock("./db", () => dbMocks);
vi.mock("./_core/env", () => ({ ENV: { telegramBotToken: undefined } }));

import { createDailyMarketDigest } from "./dailyMarketDigest";

describe("الملخص اليومي للسوق", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يجمع لقطة السوق والرابحين والخاسرين عبر MCP القائم", async () => {
    mcpMocks.callTradingViewTool.mockImplementation((tool: string) => {
      if (tool === "market_snapshot") return Promise.resolve({ btc: { change: 1.2 } });
      if (tool === "top_gainers") return Promise.resolve([{ symbol: "BTCUSDT", changePercent: 2.5 }]);
      return Promise.resolve([{ symbol: "ETHUSDT", changePercent: -1.25 }]);
    });
    const digest = await createDailyMarketDigest();
    expect(digest.text).toContain("BTCUSDT +2.50%");
    expect(digest.text).toContain("ETHUSDT -1.25%");
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("market_snapshot", {});
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("top_gainers", { exchange: "BINANCE", timeframe: "1D", limit: 3 });
  });
});

import { describe, expect, it } from "vitest";
import { TRADINGVIEW_TOOL_NAMES } from "./mcpClient";

describe("TradingView MCP bridge contract", () => {
  it("يعرض جميع أدوات الإصدار المضمّن دون تكرار", () => {
    expect(TRADINGVIEW_TOOL_NAMES.length).toBeGreaterThanOrEqual(37);
    expect(new Set(TRADINGVIEW_TOOL_NAMES).size).toBe(TRADINGVIEW_TOOL_NAMES.length);
  });

  it("يتضمن أدوات لوحة AMIC الأساسية", () => {
    expect(TRADINGVIEW_TOOL_NAMES).toEqual(expect.arrayContaining([
      "top_gainers",
      "top_losers",
      "coin_analysis",
      "multi_timeframe_analysis",
      "market_snapshot",
      "stock_screener",
    ]));
  });
});

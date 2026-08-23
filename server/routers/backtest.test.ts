import { beforeEach, describe, expect, it, vi } from "vitest";

const mcpMocks = vi.hoisted(() => ({ callTradingViewTool: vi.fn() }));
vi.mock("../mcpClient", () => mcpMocks);

import { backtestRouter } from "./backtest";

const context = { user: { id: 9, role: "user" } } as never;

describe("backtestRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يمرر سجل الصفقات ومنحنى الأداء إلى أداة الباكتيست القائمة", async () => {
    mcpMocks.callTradingViewTool.mockResolvedValue({ total_return_pct: 8.4, trade_log: [], equity_curve: [] });
    const result = await backtestRouter.createCaller(context).run({ symbol: "BTC-USD", strategy: "rsi", period: "1y", initialCapital: 10_000, commissionPct: 0.1, slippagePct: 0.05, interval: "1d" });
    expect(result).toMatchObject({ total_return_pct: 8.4 });
    expect(mcpMocks.callTradingViewTool).toHaveBeenCalledWith("backtest_strategy", expect.objectContaining({ symbol: "BTC-USD", strategy: "rsi", include_trade_log: true, include_equity_curve: true }));
  });

  it("يرفض الرمز غير المسموح قبل الاتصال بالخدمة", async () => {
    await expect(backtestRouter.createCaller(context).run({ symbol: "BTC USD", strategy: "rsi", period: "1y", initialCapital: 10_000, commissionPct: 0.1, slippagePct: 0.05, interval: "1d" })).rejects.toThrow();
    expect(mcpMocks.callTradingViewTool).not.toHaveBeenCalled();
  });
});

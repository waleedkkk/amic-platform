import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  getMarketSnapshot: vi.fn(),
  saveMarketSnapshot: vi.fn(),
  getUserMarketPulsePreferences: vi.fn(),
  saveUserMarketPulsePreferences: vi.fn(),
  getUserAnalysisExternalContextPreferences: vi.fn(),
  saveUserAnalysisExternalContextPreferences: vi.fn(),
  listUserWatchlist: vi.fn(),
  addUserWatchlistItem: vi.fn(),
  removeUserWatchlistItem: vi.fn(),
}));

const mcpMocks = vi.hoisted(() => ({
  callTradingViewTool: vi.fn(),
  isTradingViewMcpAvailabilityError: vi.fn(() => false),
  listTradingViewTools: vi.fn(),
  TRADINGVIEW_TOOL_NAMES: ["coin_analysis", "top_gainers", "rating_filter"] as const,
}));

vi.mock("../db", () => databaseMocks);
vi.mock("../mcpClient", () => mcpMocks);

import { cached, marketRouter } from "./market";

const publicContext: TrpcContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const authenticatedContext: TrpcContext = {
  user: {
    id: 77,
    openId: "pulse-user",
    name: "Pulse user",
    email: "pulse@example.com",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
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

  it("يبقي التحليل الأساسي متاحًا عند تعذر أصل واحد من أصول السياق المترابط", async () => {
    databaseMocks.getMarketSnapshot.mockResolvedValue(undefined);
    databaseMocks.saveMarketSnapshot.mockResolvedValue(undefined);
    mcpMocks.callTradingViewTool.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      if (args.symbol === "DXY") throw new Error("رمز غير مدعوم");
      if (args.symbol === "XAUUSD") return { price_data: { current_price: 2400, change_percent: 1.1 }, market_sentiment: { buy_sell_signal: "BUY" } };
      return { price_data: { current_price: 100, change_percent: 0.5 }, market_sentiment: { buy_sell_signal: "NEUTRAL" } };
    });
    const caller = marketRouter.createCaller(publicContext);

    const result = await caller.analysis({ symbol: "XAUUSD", exchange: "FX", timeframe: "1h" });

    expect(result).toMatchObject({ symbol: "XAUUSD", price: { current: 2400 } });
    expect(result.correlationContext?.items.map(item => item.id)).not.toContain("dxy");
  });

  it("يشارك التحميل الخارجي بين طلبين متزامنين للمفتاح نفسه", async () => {
    databaseMocks.getMarketSnapshot.mockResolvedValue(undefined);
    databaseMocks.saveMarketSnapshot.mockResolvedValue(undefined);
    let resolveLoad!: (value: { value: string }) => void;
    const load = vi.fn(() => new Promise<{ value: string }>(resolve => { resolveLoad = resolve; }));

    const first = cached("test:coalesced", "analysis", "BINANCE", "1h", 45, load);
    const second = cached("test:coalesced", "analysis", "BINANCE", "1h", 45, load);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    resolveLoad({ value: "shared" });
    await expect(Promise.all([first, second])).resolves.toEqual([{ value: "shared" }, { value: "shared" }]);
  });
});

describe("marketRouter.pulse", () => {
  it("يعيد أقسامًا افتراضية وقائمة المستخدم الحالي فقط عند غياب تفضيل محفوظ", async () => {
    databaseMocks.getUserMarketPulsePreferences.mockResolvedValue(undefined);
    databaseMocks.listUserWatchlist.mockResolvedValue([{ symbol: "BTCUSDT", exchange: "BINANCE", assetClass: "crypto" }]);
    const caller = marketRouter.createCaller(authenticatedContext);

    await expect(caller.pulse.getPreferences()).resolves.toMatchObject({
      sections: ["cryptoGainers", "cryptoLosers", "stockGainers", "stockLosers"],
      widgets: ["summary", "preciousMetals", "watchlist", "correlation", "globalSnapshot", "assistantContext"],
      watchlist: [{ symbol: "BTCUSDT", exchange: "BINANCE" }],
    });
    expect(databaseMocks.getUserMarketPulsePreferences).toHaveBeenCalledWith(77);
    expect(databaseMocks.listUserWatchlist).toHaveBeenCalledWith(77);
  });

  it("يطبع الأقسام والوحدات المحفوظة ويصنف رمز المستخدم وفق سوقه", async () => {
    databaseMocks.getUserMarketPulsePreferences.mockResolvedValue({ sections: { sections: ["cryptoGainers"], widgets: ["summary"] } });
    databaseMocks.saveUserMarketPulsePreferences.mockResolvedValue({ sections: ["stockLosers"] });
    databaseMocks.listUserWatchlist.mockResolvedValue([]);
    databaseMocks.addUserWatchlistItem.mockResolvedValue([{ symbol: "XAUUSD", exchange: "FX", assetClass: "futures" }]);
    const caller = marketRouter.createCaller(authenticatedContext);

    await caller.pulse.saveSections({ sections: ["stockLosers", "stockLosers"] });
    expect(databaseMocks.saveUserMarketPulsePreferences).toHaveBeenCalledWith(77, { sections: ["stockLosers"], widgets: ["summary"] });

    await caller.pulse.savePreferences({ sections: ["cryptoLosers"], widgets: ["watchlist", "assistantContext", "assistantContext"] });
    expect(databaseMocks.saveUserMarketPulsePreferences).toHaveBeenLastCalledWith(77, { sections: ["cryptoLosers"], widgets: ["watchlist", "assistantContext"] });

    await caller.pulse.addSymbol({ symbol: "xauusd", exchange: "fx" });
    expect(databaseMocks.addUserWatchlistItem).toHaveBeenCalledWith(77, { symbol: "XAUUSD", exchange: "FX", assetClass: "futures" });
  });

  it("يعيد فشل الرمز الشخصي كحالة جزئية ولا يحجب الرموز السليمة", async () => {
    databaseMocks.listUserWatchlist.mockResolvedValue([
      { symbol: "BTCUSDT", exchange: "BINANCE", assetClass: "crypto" },
      { symbol: "ETHUSDT", exchange: "BINANCE", assetClass: "crypto" },
    ]);
    databaseMocks.getMarketSnapshot.mockResolvedValue(undefined);
    databaseMocks.saveMarketSnapshot.mockResolvedValue(undefined);
    mcpMocks.callTradingViewTool.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      if (args.symbol === "ETHUSDT") throw new Error("المزود غير متاح للرمز");
      return { price_data: { current_price: 65_000, change_percent: 2.3 }, market_sentiment: { buy_sell_signal: "BUY" } };
    });
    const caller = marketRouter.createCaller(authenticatedContext);

    const result = await caller.pulse.watchlistQuotes();

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "BTCUSDT", price: 65_000, error: null }),
      expect.objectContaining({ symbol: "ETHUSDT", price: null, error: expect.stringContaining("بقية القائمة") }),
    ]));
  });
});

describe("marketRouter.externalContext", () => {
  it("يعيد تفضيلات السياق للحساب الحالي فقط عند عدم وجود إعدادات محفوظة", async () => {
    databaseMocks.getUserAnalysisExternalContextPreferences.mockResolvedValue(undefined);
    const caller = marketRouter.createCaller(authenticatedContext);

    await expect(caller.externalContext.getPreferences()).resolves.toEqual({ references: [] });
    expect(databaseMocks.getUserAnalysisExternalContextPreferences).toHaveBeenCalledWith(77);
  });

  it("يطبع الرموز المرجعية ويحفظها تحت حساب المستخدم الحالي", async () => {
    databaseMocks.saveUserAnalysisExternalContextPreferences.mockResolvedValue({ references: [{ symbol: "XAGUSD", exchange: "FX" }] });
    const caller = marketRouter.createCaller(authenticatedContext);

    await caller.externalContext.savePreferences({ references: [{ symbol: "xagusd", exchange: "fx" }, { symbol: "XAGUSD", exchange: "FX" }] });

    expect(databaseMocks.saveUserAnalysisExternalContextPreferences).toHaveBeenCalledWith(77, [{ symbol: "XAGUSD", exchange: "FX" }]);
  });
});

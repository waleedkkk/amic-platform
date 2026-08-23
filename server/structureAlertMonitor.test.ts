import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeMarketStructure: vi.fn(),
  createStructureAlertNotification: vi.fn(),
  getCandleHistoryCached: vi.fn(),
  listActiveStructureAlerts: vi.fn(),
  markStructureAlertTriggered: vi.fn(),
}));

vi.mock("../shared/marketStructure", () => ({ analyzeMarketStructure: mocks.analyzeMarketStructure }));
vi.mock("./candles", () => ({ getCandleHistoryCached: mocks.getCandleHistoryCached }));
vi.mock("./db", () => ({
  createStructureAlertNotification: mocks.createStructureAlertNotification,
  listActiveStructureAlerts: mocks.listActiveStructureAlerts,
  markStructureAlertTriggered: mocks.markStructureAlertTriggered,
}));
vi.mock("./_core/env", () => ({ ENV: { telegramBotToken: "" } }));

import { checkActiveStructureAlerts } from "./structureAlertMonitor";

const activeBreakoutAlert = {
  alert: {
    id: 19,
    userId: 73,
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    interval: "15m",
    eventType: "breakout",
  },
  telegram: null,
};

describe("checkActiveStructureAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listActiveStructureAlerts.mockResolvedValue([activeBreakoutAlert]);
    mocks.getCandleHistoryCached.mockResolvedValue({ candles: [{ time: 1, open: 100, high: 102, low: 99, close: 101 }] });
    mocks.analyzeMarketStructure.mockReturnValue({
      events: [{ kind: "bullish-breakout", time: 1710000000, price: 100.125 }],
      zones: [{ id: "zone-a" }, { id: "zone-b" }],
    });
  });

  it("يطلق الحدث مرة واحدة ويسجل قيمته وسياقه القابل للتدقيق", async () => {
    mocks.markStructureAlertTriggered.mockResolvedValue(true);

    await expect(checkActiveStructureAlerts()).resolves.toEqual({ checked: 1, triggered: 1, telegramDelivered: 0 });

    expect(mocks.markStructureAlertTriggered).toHaveBeenCalledWith(19, {
      price: "100.12500000",
      eventKey: "bullish-breakout:1710000000:100.12500000",
      qualityScore: 70,
    });
    expect(mocks.createStructureAlertNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 73,
      metadata: expect.objectContaining({
        alertId: 19,
        eventKind: "bullish-breakout",
        eventTime: 1710000000,
        price: 100.125,
        qualityScore: 70,
      }),
    }));
  });

  it("لا ينشئ إشعارًا مكررًا عندما لا تنجح المطالبة الذرية بالتنبيه", async () => {
    mocks.markStructureAlertTriggered.mockResolvedValue(false);

    await expect(checkActiveStructureAlerts()).resolves.toEqual({ checked: 1, triggered: 0, telegramDelivered: 0 });

    expect(mocks.createStructureAlertNotification).not.toHaveBeenCalled();
  });

  it("يقيم تنبيه 4h بشموع أربع ساعات حقيقية وبنطاق تاريخي مناسب", async () => {
    mocks.listActiveStructureAlerts.mockResolvedValue([{ ...activeBreakoutAlert, alert: { ...activeBreakoutAlert.alert, interval: "4h" } }]);
    mocks.markStructureAlertTriggered.mockResolvedValue(false);

    await checkActiveStructureAlerts();

    expect(mocks.getCandleHistoryCached).toHaveBeenCalledWith("BTCUSDT", "BINANCE", "4h", "3mo");
  });
});

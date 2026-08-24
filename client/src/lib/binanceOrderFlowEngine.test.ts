import { describe, expect, it } from "vitest";
import { BinanceOrderFlowEngine, normalizeBinanceOrderFlowSymbols, orderFlowPercent } from "./binanceOrderFlowEngine";

describe("BinanceOrderFlowEngine", () => {
  it("يحسب عدم توازن العمق من أفضل المستويات ويحتفظ بحالة الرمز مستقلة", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT", "ETHUSDT"]);
    engine.applyDepth("BTCUSDT", { bids: [["100", "4"]], asks: [["101", "1"]] }, 1_000);
    const bitcoin = engine.snapshots().find(item => item.symbol === "BTCUSDT");
    const ether = engine.snapshots().find(item => item.symbol === "ETHUSDT");
    expect(bitcoin?.depthImbalance).toBeCloseTo(0.6);
    expect(bitcoin?.depthLevels).toBe(2);
    expect(ether?.depthImbalance).toBeNull();
  });

  it("يحسب CVD تقريبيًا من اتجاه الصفقة ويصنف الصفقة الكبيرة بالنسبة للنشاط السابق", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"]);
    for (let id = 1; id <= 20; id += 1) engine.applyTrade("BTCUSDT", { p: "100", q: "1", m: false, t: id, T: id * 1_000 });
    engine.applyTrade("BTCUSDT", { p: "100", q: "100", m: true, t: 21, T: 21_000 });
    const snapshot = engine.snapshots()[0];
    expect(snapshot?.cvdApprox).toBe(-80);
    expect(snapshot?.events[0]).toMatchObject({ kind: "large_trade", side: "aggressive_sell", notional: 10_000 });
  });

  it("يطبع الرموز المدعومة ويحد الاشتراك المحلي إلى خمسة رموز", () => {
    expect(normalizeBinanceOrderFlowSymbols(["btcusdt", "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "UNKNOWN"]))
      .toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT"]);
    expect(orderFlowPercent(0.125)).toBe("+12.5%");
  });
});

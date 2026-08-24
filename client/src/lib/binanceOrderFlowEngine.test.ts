import { describe, expect, it } from "vitest";
import { BinanceOrderFlowEngine, MAX_CVD_DISPLAY_POINTS, normalizeBinanceOrderFlowSymbols, orderFlowPercent } from "./binanceOrderFlowEngine";
import { DEFAULT_ORDER_FLOW_PREFERENCES } from "../../../shared/orderFlowPreferences";

describe("BinanceOrderFlowEngine", () => {
  it("يحسب عدم توازن العمق من أفضل المستويات ويحتفظ بحالة الرمز مستقلة", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT", "ETHUSDT"], DEFAULT_ORDER_FLOW_PREFERENCES);
    engine.applyDepth("BTCUSDT", { bids: [["100", "4"]], asks: [["101", "1"]] }, 1_000);
    const bitcoin = engine.snapshots().find(item => item.symbol === "BTCUSDT");
    const ether = engine.snapshots().find(item => item.symbol === "ETHUSDT");
    expect(bitcoin?.depthImbalance).toBeCloseTo(0.6);
    expect(bitcoin?.depthLevels).toBe(2);
    expect(ether?.depthImbalance).toBeNull();
  });

  it("يحسب CVD تقريبيًا من اتجاه الصفقة ويصنف الصفقة الكبيرة بالنسبة للنشاط السابق", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"], DEFAULT_ORDER_FLOW_PREFERENCES);
    for (let id = 1; id <= 20; id += 1) engine.applyTrade("BTCUSDT", { p: "100", q: "1", m: false, t: id, T: id * 1_000 });
    engine.applyTrade("BTCUSDT", { p: "100", q: "100", m: true, t: 21, T: 21_000 });
    const snapshot = engine.snapshots()[0];
    expect(snapshot?.cvdApprox).toBe(-80);
    expect(snapshot?.events[0]).toMatchObject({ kind: "large_trade", side: "aggressive_sell", notional: 10_000, observedAt: 21_000 });
    expect(snapshot?.cvdSeries).toHaveLength(21);
    expect(snapshot?.cvdSeries.at(-1)).toMatchObject({ cvd: -80, delta: -100, largeTradeCount: 1 });
  });

  it("يطبع الرموز المدعومة ويحد الاشتراك المحلي إلى خمسة رموز", () => {
    expect(normalizeBinanceOrderFlowSymbols(["btcusdt", "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "UNKNOWN"]))
      .toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT"]);
    expect(orderFlowPercent(0.125)).toBe("+12.5%");
  });

  it("يطبق عمق الدفتر وحد الصفقة الكبيرة المخصصين للمستخدم", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"], { depthLevels: 5, largeTradeMinNotional: 20_000 });
    engine.applyDepth("BTCUSDT", { bids: [["1", "2"], ["1", "2"], ["1", "2"], ["1", "2"], ["1", "2"], ["1", "99"]], asks: [["1", "1"], ["1", "1"], ["1", "1"], ["1", "1"], ["1", "1"], ["1", "99"]] });
    for (let id = 1; id <= 20; id += 1) engine.applyTrade("BTCUSDT", { p: "100", q: "1", m: false, t: id, T: id * 1_000 });
    engine.applyTrade("BTCUSDT", { p: "100", q: "100", m: true, t: 21, T: 21_000 });
    const snapshot = engine.snapshots()[0];
    expect(snapshot?.bidLiquidity).toBe(10);
    expect(snapshot?.askLiquidity).toBe(5);
    expect(snapshot?.events).toHaveLength(0);
  });

  it("يقصر سلسلة CVD على نافذة زمنية متحركة ويعيد ضبطها عند تجاوز خمس دقائق", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"], DEFAULT_ORDER_FLOW_PREFERENCES);
    engine.applyTrade("BTCUSDT", { p: "100", q: "2", m: false, t: 1, T: 1_000 });
    engine.applyTrade("BTCUSDT", { p: "100", q: "3", m: true, t: 2, T: 302_000 });
    const snapshot = engine.snapshots()[0];
    expect(snapshot?.cvdApprox).toBe(-3);
    expect(snapshot?.cvdSeries).toEqual([expect.objectContaining({ delta: -3, cvd: -3, time: 302 })]);
  });

  it("يجمع صفقات الثانية الواحدة في نقطة CVD واحدة مع أحجام الشراء والبيع", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"], DEFAULT_ORDER_FLOW_PREFERENCES);
    engine.applyTrade("BTCUSDT", { p: "100", q: "2", m: false, t: 1, T: 1_100 });
    engine.applyTrade("BTCUSDT", { p: "100", q: "0.5", m: true, t: 2, T: 1_900 });
    expect(engine.snapshots()[0]?.cvdSeries).toEqual([expect.objectContaining({ time: 1, delta: 1.5, cvd: 1.5, buyVolume: 2, sellVolume: 0.5 })]);
  });

  it("لا يغير عمق الدفتر سلسلة CVD أو Delta لأنهما يعتمدان على كل الصفقات", () => {
    const shallow = new BinanceOrderFlowEngine(["BTCUSDT"], { depthLevels: 5, largeTradeMinNotional: 5_000 });
    const deep = new BinanceOrderFlowEngine(["BTCUSDT"], { depthLevels: 20, largeTradeMinNotional: 5_000 });
    const trades = [
      { p: "100", q: "2", m: false, t: 1, T: 1_000 },
      { p: "100", q: "1", m: true, t: 2, T: 2_000 },
    ];
    trades.forEach(trade => {
      shallow.applyTrade("BTCUSDT", trade);
      deep.applyTrade("BTCUSDT", trade);
    });
    expect(shallow.snapshots()[0]?.cvdSeries).toEqual(deep.snapshots()[0]?.cvdSeries);
  });

  it("يحافظ على أقصى عدد نقاط للعرض رغم امتداد نافذة الخمس دقائق", () => {
    const engine = new BinanceOrderFlowEngine(["BTCUSDT"], DEFAULT_ORDER_FLOW_PREFERENCES);
    for (let second = 0; second <= 300; second += 1) {
      engine.applyTrade("BTCUSDT", { p: "100", q: "1", m: false, t: second, T: second * 1_000 });
    }
    const snapshot = engine.snapshots()[0];
    expect(snapshot?.cvdApprox).toBe(301);
    expect(snapshot?.cvdSeries.length).toBe(MAX_CVD_DISPLAY_POINTS);
    expect(snapshot?.cvdSeries[0]?.time).toBe(0);
    expect(snapshot?.cvdSeries.at(-1)?.time).toBe(300);
  });
});
